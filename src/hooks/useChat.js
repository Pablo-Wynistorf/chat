import { useState, useCallback, useRef, useEffect } from 'react';
import { loadChatsRaw, loadChats, saveChats, deleteChatsFiles, deleteAllFiles, loadActiveChatId } from '../lib/storage';
import { getSetting } from '../lib/settings';
import { deleteFiles } from '../lib/fileStore';

// Collect fileIds from an array of messages
function collectFileIds(messages) {
  const ids = [];
  for (const m of messages) {
    if (m.files) for (const f of m.files) { if (f.fileId) ids.push(f.fileId); }
  }
  return ids;
}
export function useChat() {
  const [chats, setChats] = useState(loadChatsRaw);
  const [activeChatId, setActiveChatId] = useState(loadActiveChatId);
  const [streaming, setStreaming] = useState(false);
  const [ready, setReady] = useState(false);
  const abortRef = useRef(null);

  const chatsRef = useRef(chats);
  const activeIdRef = useRef(activeChatId);

  // Hydrate file content from IndexedDB on mount
  useEffect(() => {
    loadChats().then(hydrated => {
      chatsRef.current = hydrated;
      setChats(hydrated);
      setReady(true);
    });
  }, []);

  const persist = useCallback((newChats, newActiveId) => {
    chatsRef.current = newChats;
    activeIdRef.current = newActiveId;
    setChats(newChats);
    setActiveChatId(newActiveId);
    saveChats(newChats, newActiveId);
  }, []);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const newChat = useCallback(() => {
    const c = { id: crypto.randomUUID(), title: 'New chat', messages: [], created: Date.now() };
    const updated = [c, ...chatsRef.current];
    persist(updated, c.id);
    return c.id;
  }, [persist]);

  const selectChat = useCallback((id) => {
    persist(chatsRef.current, id);
  }, [persist]);

  const deleteChat = useCallback((id) => {
    const current = chatsRef.current;
    const deleted = current.filter(c => c.id === id);
    const updated = current.filter(c => c.id !== id);
    const currentActive = activeIdRef.current;
    const newActive = currentActive === id ? (updated[0]?.id || null) : currentActive;
    deleteChatsFiles(deleted);
    persist(updated, newActive);
    return newActive;
  }, [persist]);

  const deleteAllChats = useCallback(() => {
    deleteAllFiles();
    persist([], null);
  }, [persist]);

  const ensureChat = useCallback(() => {
    const current = chatsRef.current;
    const currentActive = activeIdRef.current;
    if (currentActive && current.find(c => c.id === currentActive)) {
      return currentActive;
    }
    return newChat();
  }, [newChat]);

  const addUserMessage = useCallback((text, files = []) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;

    const system = getSetting('systemPrompt');
    if (chat.messages.length === 0 && system) {
      chat.messages.push({ role: 'system', content: system });
    }

    const textFiles = files.filter(f => f.type === 'text');
    const imageFiles = files.filter(f => f.type === 'image');

    let fileContent = '';
    if (textFiles.length) {
      fileContent = textFiles.map(f => `--- ${f.name} ---\n${f.content}\n--- end ---`).join('\n\n');
    }

    const msg = {
      role: 'user',
      content: text || (imageFiles.length ? '(image attached)' : ''),
      fileContent: fileContent || undefined,
      files: files.length ? files : undefined,
      images: imageFiles.length ? imageFiles.map(f => f.content) : undefined,
    };

    chat.messages.push(msg);
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = (text || files[0]?.name || 'New chat').slice(0, 50);
    }

    persist(current, currentActive);
    return chat;
  }, [persist]);

  const addAssistantMessage = useCallback((text) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return;
    chat.messages.push({ role: 'assistant', content: text });
    persist(current, currentActive);
  }, [persist]);

  const appendToLastAssistant = useCallback((text) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') {
        chat.messages[i].content += text;
        break;
      }
    }
    persist(current, currentActive);
  }, [persist]);

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

  const editMessage = useCallback((idx) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return '';
    const content = chat.messages[idx].content;
    const removed = chat.messages.slice(idx);
    const ids = collectFileIds(removed);
    if (ids.length) deleteFiles(ids);
    chat.messages = chat.messages.slice(0, idx);
    persist(current, currentActive);
    return content;
  }, [persist]);

  const updateMessage = useCallback((idx, newContent) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    chat.messages[idx].content = newContent;
    const removed = chat.messages.slice(idx + 1);
    const ids = collectFileIds(removed);
    if (ids.length) deleteFiles(ids);
    chat.messages = chat.messages.slice(0, idx + 1);
    persist(current, currentActive);
    return chat;
  }, [persist]);

  const regenerate = useCallback((idx) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    const removed = chat.messages.slice(idx);
    const ids = collectFileIds(removed);
    if (ids.length) deleteFiles(ids);
    chat.messages = chat.messages.slice(0, idx);
    persist(current, currentActive);
    return chat;
  }, [persist]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setStreaming(false);
  }, []);

  return {
    chats, activeChat, activeChatId, streaming, abortRef, ready,
    setStreaming, newChat, selectChat, deleteChat, deleteAllChats,
    ensureChat, addUserMessage, addAssistantMessage, appendToLastAssistant,
    getLastAssistantContent, editMessage, updateMessage,
    regenerate, stopStreaming, persist, chatsRef, activeIdRef,
  };
}
