import { useState, useCallback, useRef } from 'react';
import { loadChats, saveChats, loadActiveChatId, getCfgValue } from '../lib/storage';

export function useChat() {
  const [chats, setChats] = useState(loadChats);
  const [activeChatId, setActiveChatId] = useState(loadActiveChatId);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  // Keep a ref so callbacks always see the latest chats without stale closures
  const chatsRef = useRef(chats);
  const activeIdRef = useRef(activeChatId);

  const persist = useCallback((newChats, newActiveId) => {
    chatsRef.current = newChats;
    activeIdRef.current = newActiveId;
    setChats(newChats);
    setActiveChatId(newActiveId);
    saveChats(newChats, newActiveId);
  }, []);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // Creates a new chat with a UUID, persists to localStorage, returns the id
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
    const updated = current.filter(c => c.id !== id);
    const currentActive = activeIdRef.current;
    const newActive = currentActive === id ? (updated[0]?.id || null) : currentActive;
    persist(updated, newActive);
    return newActive;
  }, [persist]);

  const deleteAllChats = useCallback(() => {
    persist([], null);
  }, [persist]);

  // Ensures there's an active chat, creating one if needed. Returns the active chat id.
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

    const system = getCfgValue('system');
    if (chat.messages.length === 0 && system) {
      chat.messages.push({ role: 'system', content: system });
    }

    let userContent = text;
    const textFiles = files.filter(f => f.type === 'text');
    const imageFiles = files.filter(f => f.type === 'image');

    if (textFiles.length) {
      const tp = textFiles.map(f => `--- ${f.name} ---\n${f.content}\n--- end ---`);
      userContent = [...tp, text].filter(Boolean).join('\n\n');
    }

    const msg = {
      role: 'user',
      content: userContent || (imageFiles.length ? '(image attached)' : ''),
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
  // Appends text to the last assistant message (for continue generating)
  const appendToLastAssistant = useCallback((text) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return;
    // Find last assistant message
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') {
        chat.messages[i].content += text;
        break;
      }
    }
    persist(current, currentActive);
  }, [persist]);

  // Gets the content of the last assistant message
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
    chat.messages = chat.messages.slice(0, idx);
    persist(current, currentActive);
    return content;
  }, [persist]);
  // Updates a message in place, truncates everything after it, returns the chat for re-streaming
  const updateMessage = useCallback((idx, newContent) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    chat.messages[idx].content = newContent;
    chat.messages = chat.messages.slice(0, idx + 1);
    persist(current, currentActive);
    return chat;
  }, [persist]);


  const regenerate = useCallback((idx) => {
    const current = [...chatsRef.current];
    const currentActive = activeIdRef.current;
    const chat = current.find(c => c.id === currentActive);
    if (!chat) return null;
    chat.messages = chat.messages.slice(0, idx);
    persist(current, currentActive);
    return chat;
  }, [persist]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setStreaming(false);
  }, []);

  return {
    chats, activeChat, activeChatId, streaming, abortRef,
    setStreaming, newChat, selectChat, deleteChat, deleteAllChats,
    ensureChat, addUserMessage, addAssistantMessage, appendToLastAssistant,
    getLastAssistantContent, editMessage, updateMessage,
    regenerate, stopStreaming, persist, chatsRef, activeIdRef,
  };
}
