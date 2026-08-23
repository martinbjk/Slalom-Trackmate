// A tiny, dependency-free IndexedDB wrapper used only to store the
// serialized SQLite database (a single Uint8Array "file") between sessions.
// Deliberately minimal — one object store, one key per saved blob — because
// the whole point of using real SQLite is that we don't need IndexedDB's
// document-store semantics for anything else.

const DB_NAME = "slalom-comp-app";
const STORE_NAME = "sqlite-blobs";
const DB_VERSION = 1;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveBlob(key: string, data: Uint8Array): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbLoadBlob(key: string): Promise<Uint8Array | null> {
  const db = await openIdb();
  const result = await new Promise<Uint8Array | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
