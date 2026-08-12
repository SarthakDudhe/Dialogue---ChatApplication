/**
 * Offline Outbox Queue Manager (IndexedDB)
 * Ensures resilient message delivery under weak or disconnected network states.
 */

const DB_NAME = 'DialogueOutboxDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingMessages';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'clientMsgId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToOutbox(messagePayload) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      ...messagePayload,
      queuedAt: new Date().toISOString(),
      status: 'QUEUED'
    };
    store.put(item);
    return item;
  } catch (err) {
    console.error('Outbox save error:', err);
    return null;
  }
}

export async function getOutboxMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function removeFromOutbox(clientMsgId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(clientMsgId);
  } catch (err) {
    console.error('Outbox remove error:', err);
  }
}
