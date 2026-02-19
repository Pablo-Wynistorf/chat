const CHATS_KEY = 'chats';
const ACTIVE_KEY = 'activeChatId';

export function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]'); }
  catch { return []; }
}

export function saveChats(chats, activeChatId) {
  const lite = chats.map(c => ({
    ...c,
    messages: c.messages.map(m => {
      const clean = { role: m.role, content: m.content };
      if (m.files) clean.files = m.files.map(f => ({ name: f.name, type: f.type }));
      return clean;
    }),
  }));
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(lite)); } catch (e) { console.warn('Storage full', e); }
  localStorage.setItem(ACTIVE_KEY, activeChatId || '');
}

export function loadActiveChatId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function getCfgValue(key) { return localStorage.getItem(`chat-${key}`) || ''; }
export function setCfgValue(key, val) { localStorage.setItem(`chat-${key}`, val); }
