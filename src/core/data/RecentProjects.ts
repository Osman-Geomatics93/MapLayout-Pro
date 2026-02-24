/**
 * Recent Projects — IndexedDB storage for recent project metadata + thumbnails.
 */

export interface RecentProject {
  id: string;
  name: string;
  savedAt: string;
  thumbnail: string; // small base64 PNG
  projectJSON: string;
}

const DB_NAME = 'maplayout-recent';
const STORE_NAME = 'recent-projects';
const DB_VERSION = 1;
const MAX_RECENT = 10;

function openRecentDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecent(project: RecentProject): Promise<void> {
  const db = await openRecentDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  store.put(project);

  // Enforce limit: keep only the most recent MAX_RECENT
  const allRequest = store.index('savedAt').openCursor(null, 'prev');
  let count = 0;
  allRequest.onsuccess = () => {
    const cursor = allRequest.result;
    if (cursor) {
      count++;
      if (count > MAX_RECENT) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getRecent(): Promise<RecentProject[]> {
  const db = await openRecentDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.index('savedAt').getAll();
    request.onsuccess = () => {
      db.close();
      // Return sorted newest first
      const results = (request.result as RecentProject[]).reverse();
      resolve(results);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteRecent(id: string): Promise<void> {
  const db = await openRecentDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Generate a small thumbnail from the layout SVG.
 * Returns a base64 PNG data URL (max ~120px wide).
 */
export function generateThumbnail(svgElement: SVGSVGElement): Promise<string> {
  return new Promise((resolve) => {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const maxW = 120;
      const scale = maxW / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxW;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png', 0.6));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(''); // fallback: no thumbnail
    };
    img.src = url;
  });
}
