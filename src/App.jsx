import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from './hooks/useChat';
import { streamChat, getConfig } from './lib/stream';
import { getUser, logout, hasRole } from './lib/auth';
import { loadUserSettings } from './lib/api';
import { updateSettings, getSettings } from './lib/settings';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import ModelPicker from './components/ModelPicker';
import MessageArea from './components/MessageArea';
import InputBar from './components/InputBar';
import ConfirmModal from './components/ConfirmModal';
import ToastContainer from './components/Toast';
import AuthScreen from './components/AuthScreen';
import ColorBends from './components/reactbits/ColorBends';

// ── URL helpers: use /c/<uuid> paths, with ?c=<uuid> fallback for GitHub Pages 404 redirect ──
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function getChatIdFromUrl() {
  // First check path: /c/<uuid> (or /base/c/<uuid>)
  const pathMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  if (pathMatch) return pathMatch[1];
  // Fallback: ?c=<uuid> (from GitHub Pages 404 redirect)
  return new URLSearchParams(window.location.search).get('c') || null;
}
function pushChatUrl(id) {
  if (id) history.pushState({ chatId: id }, '', `${BASE}/c/${id}`);
  else history.replaceState(null, '', `${BASE}/`);
}
function replaceChatUrl(id) {
  if (id) history.replaceState({ chatId: id }, '', `${BASE}/c/${id}`);
  else history.replaceState(null, '', `${BASE}/`);
}

export default function App() {
  const [authed, setAuthed] = useState(null); // null = loading, false = not authed, 'denied' = no role, true = authed

  useEffect(() => {
    getUser()
      .then(async (u) => {
        if (!u) { setAuthed(false); return; }
        const allowed = await hasRole('chatUser');
        setAuthed(allowed ? true : 'denied');
      })
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Loading...</div>;
  }
  if (authed === 'denied') {
    return <AccessDenied onLogout={() => { logout(); setAuthed(false); }} />;
  }
  if (!authed) {
    return <AuthScreen />;
  }

  return <AuthedApp onLogout={() => { logout(); setAuthed(false); }} />;
}

function AuthedApp({ onLogout }) {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load user settings from DynamoDB on mount, then decide if settings modal should open
  useEffect(() => {
    loadUserSettings().then(s => {
      if (s) {
        updateSettings({
          endpoint: s.endpoint || '',
          apiKey: s.apiKey || '',
          systemPrompt: s.systemPrompt || '',
          maxTokens: s.maxTokens || 4096,
          temperature: s.temperature ?? 1,
          selectedModel: s.selectedModel || '',
          mcpServers: s.mcpServers ? (typeof s.mcpServers === 'string' ? JSON.parse(s.mcpServers) : s.mcpServers) : [],
        });
      }
      const current = getSettings();
      if (!current.endpoint || !current.apiKey) setSettingsOpen(true);
      setSettingsLoaded(true);
    }).catch(() => {
      setSettingsOpen(true);
      setSettingsLoaded(true);
    });
  }, []);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [toolCalls, setToolCalls] = useState([]);
  const streamContentRef = useRef('');

  const updateStreamContent = useCallback((val) => {
    streamContentRef.current = val;
    setStreamContent(val);
  }, []);

  // ── Init: restore chat from URL or create a new one ──
  useEffect(() => {
    if (!chat.ready) return;
    const urlChatId = getChatIdFromUrl();
    if (urlChatId) {
      const found = chat.chatsRef.current.find(c => c.id === urlChatId);
      if (found) {
        chat.selectChat(urlChatId);
        return;
      }
    }
    // No chat UUID in URL — create a draft (no URL change)
    chat.newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.ready]);

  // ── Browser back/forward ──
  useEffect(() => {
    const handler = (e) => {
      const id = e.state?.chatId;
      if (id && chat.chatsRef.current.find(c => c.id === id)) {
        chat.selectChat(id);
      } else {
        chat.newChat();
        replaceChatUrl(null);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Streaming ──
  const doStream = useCallback(async (chatData) => {
    const { endpoint, apiKey } = getConfig();
    if (!endpoint || !apiKey) { setSettingsOpen(true); return; }
    if (endpoint && !endpoint.startsWith('https://')) {
      alert('Please use an HTTPS endpoint for security.');
      setSettingsOpen(true);
      return;
    }

    chat.setStreaming(true);
    updateStreamContent('');
    setShowContinue(false);
    setContinuing(false);
    setToolCalls([]);
    chat.abortRef.current = new AbortController();

    const handleToolCall = (event) => {
      setToolCalls(prev => {
        if (event.type === 'start') {
          return [...prev, { id: event.id, name: event.name, status: 'calling' }];
        }
        if (event.type === 'executing') {
          return prev.map(tc => tc.id === event.id ? { ...tc, status: 'executing' } : tc);
        }
        if (event.type === 'done') {
          return prev.map(tc => tc.id === event.id ? { ...tc, status: 'done' } : tc);
        }
        return prev;
      });
    };

      try {
      await streamChat(
        chatData,
        chat.abortRef.current,
        (text) => updateStreamContent(text),
        (fullText, stopReason) => {
          if (fullText) {
            chat.addAssistantMessage(fullText);
            if (stopReason === 'length') setShowContinue(true);
          }
          updateStreamContent('');
          chat.setStreaming(false);
          chat.abortRef.current = null;
        },
        handleToolCall,
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        updateStreamContent(`Error: ${err.message}`);
      } else {
        // Save whatever was generated before the abort
        const partial = streamContentRef.current;
        if (partial) {
          chat.addAssistantMessage(partial);
        }
        updateStreamContent('');
      }
      chat.setStreaming(false);
      chat.abortRef.current = null;
    }
  }, [chat]);

  // ── Send: ensures a chat exists, adds message, streams ──
  const handleSend = useCallback((text, files) => {
    const id = chat.ensureChat();
    // Push the URL now that the chat is real (first message)
    pushChatUrl(id);
    const chatData = chat.addUserMessage(text, files);
    if (chatData) doStream(chatData);
  }, [chat, doStream]);

  const handleEditSave = useCallback((idx, newContent) => {
    if (chat.streaming) return;
    const realIdx = getRealIndex(chat.activeChat, idx);
    const updated = chat.updateMessage(realIdx, newContent);
    if (updated) doStream(updated);
  }, [chat, doStream]);

  const handleCopy = useCallback((idx) => {
    const msg = chat.activeChat?.messages?.filter(m => m.role !== 'system')[idx];
    if (msg) navigator.clipboard.writeText(msg.content);
  }, [chat]);

  const handleRegenerate = useCallback((idx) => {
    if (chat.streaming) return;
    const realIdx = getRealIndex(chat.activeChat, idx);
    const updated = chat.regenerate(realIdx);
    if (updated) doStream(updated);
  }, [chat, doStream]);

  const handleContinue = useCallback(() => {
    if (chat.streaming || !chat.activeChat) return;
    setShowContinue(false);

    // Get the previous assistant content to prepend during streaming display
    const previousContent = chat.getLastAssistantContent();

    // Detect if the previous content ended mid-code-block (unclosed fence)
    const fenceMatches = previousContent.match(/```/g);
    const inCodeBlock = fenceMatches && fenceMatches.length % 2 !== 0;

    // Include the tail of the previous response so the model knows exactly where it left off
    const tail = previousContent.slice(-800);
    let continuePrompt = `Continue generating from exactly where you left off. Do not repeat any content. Here is the end of your previous response for context:\n\n...${tail}`;
    if (inCodeBlock) {
      continuePrompt += '\n\nIMPORTANT: Your previous response was cut off inside a code block. Continue the code directly WITHOUT starting a new code fence. Do NOT add ``` at the beginning — just continue the code content.';
    }

    // Build a temporary messages array with a hidden continue prompt
    const chatData = chat.activeChat;
    const continueMessages = [
      ...chatData.messages,
      { role: 'user', content: continuePrompt },
    ];

    const tempChat = { ...chatData, messages: continueMessages };

    // Clean continuation text: if we were mid-code-block, strip any leading
    // code fence the model might have added despite our instructions
    const cleanContinuation = (newText) => {
      if (!inCodeBlock) return newText;
      // Strip leading whitespace + opening code fence (``` optionally followed by a language tag)
      return newText.replace(/^\s*```[\w]*\s*\n?/, '');
    };

    // Stream, but append to the last assistant message instead of creating a new one
    const doContinueStream = async () => {
      const { endpoint, apiKey } = getConfig();
      if (!endpoint || !apiKey) { setSettingsOpen(true); return; }

      chat.setStreaming(true);
      setContinuing(true);
      updateStreamContent(previousContent);
      chat.abortRef.current = new AbortController();

      try {
        await streamChat(
          tempChat,
          chat.abortRef.current,
          (newText) => {
            const cleaned = cleanContinuation(newText);
            updateStreamContent(previousContent + cleaned);
          },
          (fullText, stopReason) => {
            if (fullText) {
              const cleaned = cleanContinuation(fullText);
              chat.appendToLastAssistant(cleaned);
              if (stopReason === 'length') setShowContinue(true);
            }
            updateStreamContent('');
            setContinuing(false);
            chat.setStreaming(false);
            chat.abortRef.current = null;
          },
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          updateStreamContent(`Error: ${err.message}`);
        } else {
          // Save the partial continuation content
          const partial = streamContentRef.current;
          if (partial) {
            // The partial content includes previousContent prefix, so extract only the new part
            const newPart = partial.slice(previousContent.length);
            if (newPart) {
              chat.appendToLastAssistant(newPart);
            }
          }
          updateStreamContent('');
        }
        setContinuing(false);
        chat.setStreaming(false);
        chat.abortRef.current = null;
      }
    };

    doContinueStream();
  }, [chat]);

  const handleDeleteChat = useCallback((id) => setDeleteTarget(id), []);
  const confirmDeleteChat = useCallback(() => {
    if (deleteTarget) {
      const newActive = chat.deleteChat(deleteTarget);
      if (newActive) {
        replaceChatUrl(newActive);
      } else {
        chat.newChat();
        replaceChatUrl(null);
      }
    }
    setDeleteTarget(null);
  }, [deleteTarget, chat]);

  const handleDeleteAll = useCallback(() => {
    setSettingsOpen(false);
    setDeleteAllOpen(true);
  }, []);
  const confirmDeleteAll = useCallback(() => {
    chat.deleteAllChats();
    setDeleteAllOpen(false);
    chat.newChat();
    replaceChatUrl(null);
  }, [chat]);

  const handleNewChat = useCallback(() => {
    // Don't create a new chat if the current one has no messages yet
    const current = chat.activeChat;
    if (current && current.messages.filter(m => m.role !== 'system').length === 0) {
      setSidebarOpen(false);
      return;
    }
    const id = chat.newChat();
    // Don't push /c/uuid — stay at root until first message
    replaceChatUrl(null);
    setSidebarOpen(false);
  }, [chat]);

  const handleSelectChat = useCallback((id) => {
    chat.selectChat(id);
    pushChatUrl(id);
    setSidebarOpen(false);
  }, [chat]);

  const showEmptyState = !chat.streaming && (!chat.activeChat?.messages?.filter(m => m.role !== 'system').length);
  const [bgFading, setBgFading] = useState(false);
  const [bgTimeOffset] = useState(() => Math.random() * 1000);
  const [bgRotation] = useState(() => Math.random() * 360);

  useEffect(() => {
    setBgFading(!showEmptyState);
  }, [showEmptyState]);

  return (
    <div className="h-full flex overflow-hidden relative">
      {(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
          opacity: bgFading ? 0.1 : 1,
          transition: 'opacity 3s ease-out',
        }}>
          <ColorBends
            rotation={bgRotation}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            parallax={0.5}
            noise={0.1}
            transparent
            autoRotate={0}
            timeOffset={bgTimeOffset}
          />
        </div>
      )}
      <Sidebar
        chats={chat.chats}
        activeChatId={chat.activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => setSettingsOpen(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        <div className="h-12 border-b border-border flex items-center gap-2 px-3 sm:px-4 shrink-0 relative z-10 backdrop-blur-xl" style={{ background: 'rgba(12,12,14,0.6)' }}>
          <button onClick={() => setSidebarOpen(true)} className="sm:hidden w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex-1 min-w-0" />
          <ModelPicker />
        </div>

        <MessageArea
          chat={chat.activeChat}
          streaming={chat.streaming}
          streamContent={streamContent}
          continuing={continuing}
          toolCalls={toolCalls}
          onEditSave={handleEditSave}
          onCopy={handleCopy}
          onRegenerate={handleRegenerate}
          onContinue={handleContinue}
          showContinue={showContinue}
        />

        <InputBar
          key={chat.activeChatId}
          onSend={handleSend}
          onStop={chat.stopStreaming}
          streaming={chat.streaming}
          centered={showEmptyState}
        />
      </main>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} onDeleteAll={handleDeleteAll} onLogout={onLogout} />
      <ConfirmModal open={!!deleteTarget} title="Delete chat?" message="This will permanently delete this conversation." onConfirm={confirmDeleteChat} onCancel={() => setDeleteTarget(null)} />
      <ConfirmModal open={deleteAllOpen} title="Delete all chats?" message="This will permanently delete all conversations. This action cannot be undone." confirmLabel="Delete All" onConfirm={confirmDeleteAll} onCancel={() => setDeleteAllOpen(false)} />
      <ToastContainer />
    </div>
  );
}

function getRealIndex(chat, displayIdx) {
  if (!chat) return displayIdx;
  let count = -1;
  for (let i = 0; i < chat.messages.length; i++) {
    if (chat.messages[i].role !== 'system') count++;
    if (count === displayIdx) return i;
  }
  return displayIdx;
}

function AccessDenied({ onLogout }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(8,8,10,0.95)' }}>
      <div className="w-[92vw] max-w-sm rounded-2xl shadow-2xl shadow-black/60 p-6 text-center"
        style={{
          background: 'rgba(16, 16, 20, 0.65)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
        <div className="text-red-400 mb-3">
          <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">Access Denied</h2>
        <p className="text-zinc-500 text-sm mb-5">Your account does not have the required role to use this app.</p>
        <button
          onClick={onLogout}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition cursor-pointer"
          style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,92,252,1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,92,252,0.8)'}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
