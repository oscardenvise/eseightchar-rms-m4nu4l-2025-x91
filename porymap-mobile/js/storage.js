// Keeps the opened project (and its unsaved edits) in IndexedDB, so relaunching
// from the home screen picks up exactly where you left off.

const DB_NAME = 'porymap-mobile';
const STORE = 'projects';
const KEY = 'current';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveSession(session) {
  try {
    await withStore('readwrite', (store) => store.put(session, KEY));
    return true;
  } catch (err) {
    console.warn('Kunde inte spara sessionen', err);
    return false;
  }
}

export async function loadSession() {
  try {
    return await withStore('readonly', (store) => store.get(KEY));
  } catch (err) {
    console.warn('Kunde inte läsa sparad session', err);
    return undefined;
  }
}

export async function clearSession() {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
    return true;
  } catch {
    return false;
  }
}
