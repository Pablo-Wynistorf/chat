import { useState, useCallback, useEffect } from 'react';
import { useChat } from './hooks/useChat';
import { streamChat, getConfig } from './lib/stream';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import ModelPicker from './components/ModelPicker';
import MessageArea from './components/MessageArea';
import InputBar from './components/InputBar';
import ConfirmModal from './components/ConfirmModal';
import ToastContainer from './components/Toast';
import Prism from './components/reactbits/Prism';

// ── URL helpers: use ?c=<uuid> query string ──
function getChatIdFromUrl() {
  return new URLSearchParams(window.location.search).get('c') || null;
}
function pushChatUrl(id) {
  if (id) history.pushState({ chatId: id }, '', `?c=${id}`);
  else history.replaceState(null, '', window.location.pathname);
}
function replaceChatUrl(id) {
  if (id) history.replaceState({ chatId: id }, '', `?c=${id}`);
  else history.replaceState(null, '', window.location.pathname);
}

export default function App() {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => {
    return !localStorage.getItem('chat-endpoint') || !localStorage.getItem('chat-apikey');
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const [continuing, setContinuing] = useState(false);

  // ── Init: restore chat from URL or create a new one ──
  useEffect(() => {
    const urlChatId = getChatIdFromUrl();
    if (urlChatId) {
      const found = chat.chatsRef.current.find(c => c.id === urlChatId);
      if (found) {
        chat.selectChat(urlChatId);
        replaceChatUrl(urlChatId);
        return;
      }
    }
    // No chat UUID in URL — always start a fresh chat
    const id = chat.newChat();
    replaceChatUrl(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Browser back/forward ──
  useEffect(() => {
    const handler = (e) => {
      const id = e.state?.chatId;
      if (id && chat.chatsRef.current.find(c => c.id === id)) {
        chat.selectChat(id);
      } else {
        const newId = chat.newChat();
        replaceChatUrl(newId);
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
    setStreamContent('');
    setShowContinue(false);
    setContinuing(false);
    chat.abortRef.current = new AbortController();

    try {
      await streamChat(
        chatData,
        chat.abortRef.current,
        (text) => setStreamContent(text),
        (fullText, stopReason) => {
          if (fullText) {
            chat.addAssistantMessage(fullText);
            if (stopReason === 'length') setShowContinue(true);
          }
          setStreamContent('');
          chat.setStreaming(false);
          chat.abortRef.current = null;
        },
        (err) => {
          setStreamContent(`Error: ${err.message}`);
          chat.setStreaming(false);
        }
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStreamContent(`Error: ${err.message}`);
      }
      chat.setStreaming(false);
      chat.abortRef.current = null;
    }
  }, [chat]);

  // ── Send: ensures a chat exists, adds message, streams ──
  const handleSend = useCallback((text, files) => {
    const id = chat.ensureChat();
    replaceChatUrl(id);
    // ensureChat guarantees activeIdRef is set synchronously via ref,
    // so addUserMessage will find the chat immediately
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
      setStreamContent(previousContent);
      chat.abortRef.current = new AbortController();

      try {
        await streamChat(
          tempChat,
          chat.abortRef.current,
          (newText) => {
            const cleaned = cleanContinuation(newText);
            setStreamContent(previousContent + cleaned);
          },
          (fullText, stopReason) => {
            if (fullText) {
              const cleaned = cleanContinuation(fullText);
              chat.appendToLastAssistant(cleaned);
              if (stopReason === 'length') setShowContinue(true);
            }
            setStreamContent('');
            setContinuing(false);
            chat.setStreaming(false);
            chat.abortRef.current = null;
          },
          (err) => {
            setStreamContent(`Error: ${err.message}`);
            setContinuing(false);
            chat.setStreaming(false);
          }
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          setStreamContent(`Error: ${err.message}`);
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
      replaceChatUrl(newActive);
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
    const id = chat.newChat();
    replaceChatUrl(id);
  }, [chat]);

  const handleNewChat = useCallback(() => {
    // Don't create a new chat if the current one has no messages yet
    const current = chat.activeChat;
    if (current && current.messages.filter(m => m.role !== 'system').length === 0) {
      setSidebarOpen(false);
      return;
    }
    const id = chat.newChat();
    pushChatUrl(id);
    setSidebarOpen(false);
  }, [chat]);

  const handleSelectChat = useCallback((id) => {
    chat.selectChat(id);
    pushChatUrl(id);
    setSidebarOpen(false);
  }, [chat]);

  const showEmptyState = !chat.streaming && (!chat.activeChat?.messages?.filter(m => m.role !== 'system').length);

  return (
    <div className="h-full flex overflow-hidden relative">
      {showEmptyState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <Prism
            animationType="rotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={5.5}
            scale={3.6}
            hueShift={0}
            colorFrequency={1}
            noise={0}
            glow={1}
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

      <main className="flex-1 flex flex-col h-full min-w-0">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 pl-14 sm:pl-4 shrink-0 relative z-10 backdrop-blur-xl" style={{ background: 'rgba(12,12,14,0.6)' }}>
          <button onClick={() => setSidebarOpen(true)} className="sm:hidden w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex-1" />
          <ModelPicker />
        </div>

        <MessageArea
          chat={chat.activeChat}
          streaming={chat.streaming}
          streamContent={streamContent}
          continuing={continuing}
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
        />
      </main>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} onDeleteAll={handleDeleteAll} />
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
