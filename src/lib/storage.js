import { saveFile, loadFile, deleteFiles, clearAllFiles, getFileIds } from './fileStore';

const CHATS_KEY = 'chats';
const ACTIVE_KEY = 'activeChatId';

export function loadChatsRaw() {
  try { return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]'); }
  catch { return []; }
}

// Hydrate file content from IndexedDB into chat messages
export async function loadChats() {
  const chats = loadChatsRaw();
  const promises = [];
  for (const c of chats) {
    for (const m of c.messages) {
      if (!m.files) continue;
      for (const f of m.files) {
        if (!f.fileId) continue;
        promises.push(
          loadFile(f.fileId).then(content => { if (content != null) f.content = content; })
        );
      }
    }
  }
  await Promise.all(promises);
  // Rebuild convenience fields from hydrated files
  for (const c of chats) {
    for (const m of c.messages) {
      if (!m.files) continue;
      const images = m.files.filter(f => f.type === 'image' && f.content);
      const textFiles = m.files.filter(f => f.type === 'text' && f.content);
      if (images.length) m.images = images.map(f => f.content);
      if (textFiles.length) {
        m.fileContent = textFiles.map(f => `--- ${f.name} ---\n${f.content}\n--- end ---`).join('\n\n');
      }
    }
  }
  return chats;
}

// Save chats to localStorage + file content to IndexedDB
export async function saveChats(chats, activeChatId) {
  const fileOps = [];
  const lite = chats.map(c => ({
    ...c,
    messages: c.messages.map(m => {
      const clean = { role: m.role, content: m.content };
      if (m.fileContent) clean.fileContent = m.fileContent;
      if (m.files) {
        clean.files = m.files.map(f => {
          const entry = { name: f.name, type: f.type };
          if (f.content) {
            // Generate a stable ID if not already assigned
            const fileId = f.fileId || `f-${crypto.randomUUID()}`;
            entry.fileId = fileId;
            // Also set fileId on the in-memory object so we don't re-generate
            f.fileId = fileId;
            fileOps.push(saveFile(fileId, f.content));
          } else if (f.fileId) {
            entry.fileId = f.fileId;
          }
          return entry;
        });
      }
      return clean;
    }),
  }));
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(lite)); } catch (e) { console.warn('Storage full', e); }
  localStorage.setItem(ACTIVE_KEY, activeChatId || '');
  if (fileOps.length) await Promise.all(fileOps);
}

// Delete files associated with specific chats
export async function deleteChatsFiles(chatsToDelete) {
  const ids = getFileIds(chatsToDelete);
  if (ids.length) await deleteFiles(ids);
}

// Delete all files from IndexedDB
export async function deleteAllFiles() {
  await clearAllFiles();
}

export function loadActiveChatId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}
