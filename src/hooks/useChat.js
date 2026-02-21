import { useState, useCallback, useRef, useEffect } from 'react';
import {
  loadChats,
  loadMessages,
  createChat,
  updateChatMeta,
  addMessage,
  truncateMessages,
  removeChat,
  removeAllChats,
} from '../lib/storage';
import { getSetting } from '../lib/settings';
import { saveFile, loadFile } from '../lib/fileStore';

export function useChat() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [ready, setReady] = useState(false);
  const abortRef = useRef(null);

  const chatsRef = useRef([]);
  const activeIdRef = useRef(null);

  // Load chat list from DynamoDB on mount
  useEffect(() => {
    loadChats().then(loaded => {
      chatsRef.current = loaded;
      setChats(loaded);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  // Helper: update local state + refs (no persistence — callers handle DB ops)
  const setLocal = useCallback((newChats, newActiveId) => {
    chatsRef.current = newChats;
    activeIdRef.current = newActiveId;
    setChats([...newChats]);
    setActiveChatId(newActiveId);
  }, []);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // ── Load messages for a chat (lazy) ──
  const ensureMessages = useCallback(async (chatId) => {
    const chat = chatsRef.current.find(c => c.id === chatId);
    if (!chat || chat._loaded) return;
    const msgs = await loadMessages(chatId);
    // Hydrate image content from IndexedDB
    for (const m of msgs) {
      if (!m.files) continue;
      for (const f of m.files) {
        if (f.type === 'image' && f.fileId) {
          const content = await loadFile(f.fileId);
          if (content) f.content = content;
        }
      }
      // Rebuild convenience images array from hydrated files
      const loaded = m.files.filter(f => f.type === 'image' && f.content);
      if (loaded.length) m.images = loaded.map(f => f.content);
    }
    chat.messages = msgs;
    chat._loaded = true;
    setChats([...chatsRef.current]);
  }, []);

  // ── New chat (draft — not persisted until first message) ──
  const newChat = useCallback(() => {
    const c = { id: crypto.randomUUID(), title: 'New chat', messages: [], created: Date.now(), _loaded: true, _draft: true };
    const updated = [c, ...chatsRef.current.filter(ch => !ch._draft)];
    setLocal(updated, c.id);
    // Don't persist to DynamoDB — this is a draft
    return c.id;
  }, [setLocal]);

  // ── Select chat ──
  const selectChat = useCallback((id) => {
    activeIdRef.current = id;
    setActiveChatId(id);
    ensureMessages(id);
  }, [ensureMessages]);

  // ── Delete chat ──
  const deleteChat = useCallback((id) => {
    const current = chatsRef.current;
    const updated = current.filter(c => c.id !== id);
    const currentActive = activeIdRef.current;
    const newActive = currentActive === id ? (updated[0]?.id || null) : currentActive;
    setLocal(updated, newActive);
    removeChat(id).catch(console.error);
    return newActive;
  }, [setLocal]);

  // ── Delete all chats ──
  const deleteAllChats = useCallback(() => {
    setLocal([], null);
    removeAllChats().catch(console.error);
  }, [setLocal]);

  // ── Ensure a chat exists ──
  const ensureChat = useCallback(() => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    if (currentActive && current.find(c => c.id === currentActive)) {
      return currentActive;
    }
    return newChat();
  }, [newChat]);

  // ── Add user message ──
  const addUserMessage = useCallback((text, files = []) => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;

    // If this is a draft chat, persist it to DynamoDB now
    if (chat._draft) {
      chat._draft = false;
      createChat(chat).catch(console.error);
    }

    const system = getSetting('systemPrompt');
    if (chat.messages.length === 0 && system) {
      const sysMsg = { role: 'system', content: system };
      chat.messages.push(sysMsg);
      addMessage(chat.id, sysMsg, chat.messages.length).catch(console.error);
    }

    const textFiles = files.filter(f => f.type === 'text');
    const imageFiles = files.filter(f => f.type === 'image');

    let fileContent = '';
    if (textFiles.length) {
      fileContent = textFiles.map(f => `--- ${f.name} ---\n${f.content}\n--- end ---`).join('\n\n');
    }

    // Save images to IndexedDB, build files array with fileIds
    const fileEntries = [];
    for (const f of files) {
      if (f.type === 'image' && f.content) {
        const fileId = `f-${crypto.randomUUID()}`;
        saveFile(fileId, f.content).catch(console.error);
        fileEntries.push({ name: f.name, type: 'image', fileId, content: f.content });
      } else if (f.type === 'text') {
        fileEntries.push({ name: f.name, type: 'text' });
      }
    }

    const msg = {
      role: 'user',
      content: text || (imageFiles.length ? '(image attached)' : ''),
      fileContent: fileContent || undefined,
      images: imageFiles.length ? imageFiles.map(f => f.content) : undefined,
      files: fileEntries.length ? fileEntries : undefined,
    };

    chat.messages.push(msg);
    const sortKey = chat.messages.length;
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = (text || files[0]?.name || 'New chat').slice(0, 50);
      updateChatMeta(chat.id, { title: chat.title }).catch(console.error);
    }

    setChats([...current]);
    // For DynamoDB, strip image content — only store fileIds
    const dbMsg = {
      ...msg,
      images: undefined,
      files: fileEntries.length ? fileEntries.map(f => ({ name: f.name, type: f.type, fileId: f.fileId })) : undefined,
    };
    addMessage(chat.id, dbMsg, sortKey).catch(console.error);
    return chat;
  }, []);

  // ── Add assistant message ──
  const addAssistantMessage = useCallback((text) => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return;
    const msg = { role: 'assistant', content: text };
    chat.messages.push(msg);
    const sortKey = chat.messages.length;
    setChats([...current]);
    addMessage(chat.id, msg, sortKey).catch(console.error);
  }, []);

  // ── Append to last assistant message ──
  const appendToLastAssistant = useCallback((text) => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') {
        chat.messages[i].content += text;
        setChats([...current]);
        // Update in DB: delete old message at this sortKey and re-create with full content
        const sortKey = i + 1;
        truncateMessages(chat.id, sortKey).then(() =>
          addMessage(chat.id, chat.messages[i], sortKey)
        ).catch(console.error);
        break;
      }
    }
  }, []);

  const getLastAssistantContent = useCallback(() => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return '';
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') return chat.messages[i].content;
    }
    return '';
  }, []);

  // ── Update (edit) a message and truncate everything after it ──
  const updateMessage = useCallback((idx, newContent) => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    chat.messages[idx].content = newContent;
    chat.messages = chat.messages.slice(0, idx + 1);
    setChats([...current]);
    // Delete from idx onward in DB, then re-add the edited message
    truncateMessages(chat.id, idx + 1).then(() =>
      addMessage(chat.id, chat.messages[idx], idx + 1)
    ).catch(console.error);
    return chat;
  }, []);

  // ── Regenerate from a given index ──
  const regenerate = useCallback((idx) => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    chat.messages = chat.messages.slice(0, idx);
    setChats([...current]);
    truncateMessages(chat.id, idx + 1).catch(console.error);
    return chat;
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setStreaming(false);
  }, []);

  return {
    chats, activeChat, activeChatId, streaming, abortRef, ready,
    setStreaming, newChat, selectChat, deleteChat, deleteAllChats,
    ensureChat, addUserMessage, addAssistantMessage, appendToLastAssistant,
    getLastAssistantContent, updateMessage,
    regenerate, stopStreaming, chatsRef, activeIdRef,
    ensureMessages,
  };
}
