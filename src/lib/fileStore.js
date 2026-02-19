const DB_NAME = 'chat-files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE_NAME, mode);
    const store = t.objectStore(STORE_NAME);
    return { store, done: new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; }) };
  });
}

export async function saveFile(id, content) {
  const { store, done } = await tx('readwrite');
  store.put(content, id);
  await done;
}

export async function loadFile(id) {
  const { store } = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFiles(ids) {
  if (!ids.length) return;
  const { store, done } = await tx('readwrite');
  ids.forEach(id => store.delete(id));
  await done;
}

export async function clearAllFiles() {
  const { store, done } = await tx('readwrite');
  store.clear();
  await done;
}

// Extract all file IDs referenced by a set of chats
export function getFileIds(chats) {
  const ids = [];
  for (const c of chats) {
    for (const m of c.messages) {
      if (m.files) {
        for (const f of m.files) {
          if (f.fileId) ids.push(f.fileId);
        }
      }
    }
  }
  return ids;
}
