/**
 * Version History — IndexedDB store for layout version snapshots.
 * Auto-saves periodically and supports manual version labeling.
 */

const DB_NAME = 'maplayout-versions';
const STORE_NAME = 'versions';
const DB_VERSION = 1;
const MAX_VERSIONS_PER_PROJECT = 50;

export interface VersionSnapshot {
  id: string;
  projectId: string;
  savedAt: string;
  thumbnail: string;
  stateJSON: string;
  label?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a version snapshot */
export async function saveVersion(snapshot: VersionSnapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(snapshot);
    tx.oncomplete = () => {
      resolve();
      // Purge old versions
      purgeOldVersions(snapshot.projectId).catch(() => {});
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all versions for a project, sorted by savedAt descending */
export async function getVersions(projectId: string): Promise<VersionSnapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('projectId');
    const req = idx.getAll(projectId);
    req.onsuccess = () => {
      const results = req.result as VersionSnapshot[];
      results.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete a specific version */
export async function deleteVersion(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update the label of a version */
export async function labelVersion(id: string, label: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const snap = req.result as VersionSnapshot;
      if (snap) {
        snap.label = label;
        store.put(snap);
      }
      tx.oncomplete = () => resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove excess versions (keep newest MAX_VERSIONS_PER_PROJECT) */
async function purgeOldVersions(projectId: string): Promise<void> {
  const versions = await getVersions(projectId);
  if (versions.length <= MAX_VERSIONS_PER_PROJECT) return;

  const db = await openDB();
  const toDelete = versions.slice(MAX_VERSIONS_PER_PROJECT);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const v of toDelete) {
    store.delete(v.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
