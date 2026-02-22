/**
 * BoundaryLoader — Fetches and caches Natural Earth boundary data.
 *
 * Strategy:
 * - 110m resolution data is small enough to bundle or fetch once and cache long-term.
 * - 50m/10m data is fetched on demand per country and cached in IndexedDB.
 * - Uses a CDN URL pattern for static GeoJSON files.
 */

const NE_CDN_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

// Public domain Natural Earth files
const BOUNDARY_URLS = {
  admin0_110m: `${NE_CDN_BASE}/ne_110m_admin_0_countries.geojson`,
  admin1_110m: `${NE_CDN_BASE}/ne_110m_admin_1_states_provinces.geojson`,
  admin0_50m: `${NE_CDN_BASE}/ne_50m_admin_0_countries.geojson`,
  admin1_50m: `${NE_CDN_BASE}/ne_50m_admin_1_states_provinces.geojson`,
} as const;

const DB_NAME = 'maplayout-boundaries';
const DB_VERSION = 1;
const STORE_NAME = 'geojson';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  key: string;
  data: GeoJSON.FeatureCollection;
  timestamp: number;
}

/** Open (or create) the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get cached GeoJSON from IndexedDB */
async function getCached(key: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Store GeoJSON in IndexedDB */
async function setCache(key: string, data: GeoJSON.FeatureCollection): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: CacheEntry = { key, data, timestamp: Date.now() };
    store.put(entry);
  } catch {
    // Caching failure is non-fatal
  }
}

/**
 * Load a GeoJSON boundary dataset. Checks cache first, fetches if needed.
 */
export async function loadBoundaries(
  datasetKey: keyof typeof BOUNDARY_URLS
): Promise<GeoJSON.FeatureCollection> {
  // Check cache
  const cached = await getCached(datasetKey);
  if (cached) return cached;

  // Fetch from CDN
  const url = BOUNDARY_URLS[datasetKey];
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${datasetKey}: ${response.status}`);
  }

  const data = (await response.json()) as GeoJSON.FeatureCollection;

  // Cache for next time
  await setCache(datasetKey, data);

  return data;
}

/**
 * Find a country feature by name (case-insensitive search).
 */
export function findCountryByName(
  fc: GeoJSON.FeatureCollection,
  name: string
): GeoJSON.Feature | null {
  const query = name.toLowerCase().trim();
  return (
    fc.features.find(
      (f) =>
        (f.properties?.NAME || '').toLowerCase() === query ||
        (f.properties?.NAME_LONG || '').toLowerCase() === query ||
        (f.properties?.ADMIN || '').toLowerCase() === query ||
        (f.properties?.ISO_A3 || '').toLowerCase() === query ||
        (f.properties?.ISO_A2 || '').toLowerCase() === query
    ) ?? null
  );
}

/**
 * Find a state/province feature by name within a country.
 */
export function findStateByName(
  fc: GeoJSON.FeatureCollection,
  stateName: string,
  countryName?: string
): GeoJSON.Feature | null {
  const query = stateName.toLowerCase().trim();
  return (
    fc.features.find((f) => {
      const nameMatch =
        (f.properties?.name || '').toLowerCase() === query ||
        (f.properties?.NAME || '').toLowerCase() === query ||
        (f.properties?.name_en || '').toLowerCase() === query;

      if (!nameMatch) return false;

      if (countryName) {
        const countryMatch =
          (f.properties?.admin || '').toLowerCase() === countryName.toLowerCase();
        return countryMatch;
      }
      return true;
    }) ?? null
  );
}

// ─── geoBoundaries API Support ────────────────────────────────────────

const GEOBOUNDARIES_API = 'https://www.geoboundaries.org/api/current/gbOpen';

export type AdminLevel = 'ADM1' | 'ADM2';

interface GeoBoundariesMeta {
  simplifiedGeometryGeoJSON: string;
  gjDownloadURL: string;
  boundaryName: string;
}

/**
 * Extract ISO_A3 code from a Natural Earth country feature.
 * Falls back to '-99' if not found.
 */
export function getCountryISO3(feature: GeoJSON.Feature): string {
  const iso = feature.properties?.ISO_A3 ?? feature.properties?.iso_a3 ?? '-99';
  // Some Natural Earth features have '-99' for disputed territories
  return typeof iso === 'string' ? iso : '-99';
}

/**
 * Load admin boundaries (states/districts) for a country from geoBoundaries API.
 *
 * Two-step fetch: metadata → simplified GeoJSON.
 * Caches in IndexedDB with 30-day TTL (reuses existing cache pattern).
 * Property names are normalized: `shapeName` → `NAME` for consistency.
 */
export async function loadAdminBoundaries(
  countryISO3: string,
  adminLevel: AdminLevel
): Promise<GeoJSON.FeatureCollection> {
  const cacheKey = `geoboundaries_${countryISO3}_${adminLevel}`;

  // Check cache first
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Step 1: Fetch metadata
  const metaUrl = `${GEOBOUNDARIES_API}/${countryISO3}/${adminLevel}/`;
  const metaResponse = await fetch(metaUrl);
  if (!metaResponse.ok) {
    throw new Error(`No ${adminLevel} data for ${countryISO3} (HTTP ${metaResponse.status})`);
  }

  const meta = (await metaResponse.json()) as GeoBoundariesMeta;

  // Step 2: Fetch simplified GeoJSON via service worker proxy.
  // Files are stored in Git LFS — github.com/raw/ URLs redirect through the LFS
  // media server (media.githubusercontent.com). Extension page CSP blocks the redirect,
  // so we route through the service worker which isn't subject to extension_pages CSP.
  const geoUrl = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL;
  if (!geoUrl) {
    throw new Error(`No GeoJSON URL in ${adminLevel} metadata for ${countryISO3}`);
  }

  let data: GeoJSON.FeatureCollection;

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    // Extension mode — route through service worker to bypass CSP
    const proxyResult = await chrome.runtime.sendMessage({
      action: 'proxyFetch',
      url: geoUrl,
    }) as { data?: string; error?: string };

    if (proxyResult.error) {
      throw new Error(`Failed to fetch ${adminLevel} GeoJSON for ${countryISO3}: ${proxyResult.error}`);
    }
    if (!proxyResult.data) {
      throw new Error(`Empty response for ${adminLevel} GeoJSON for ${countryISO3}`);
    }

    data = JSON.parse(proxyResult.data) as GeoJSON.FeatureCollection;
  } else {
    // Standalone web mode — direct fetch (CORS-enabled APIs)
    const response = await fetch(geoUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${adminLevel} GeoJSON for ${countryISO3}: HTTP ${response.status}`);
    }
    data = (await response.json()) as GeoJSON.FeatureCollection;
  }

  // Normalize property names for consistency
  const normalized: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: data.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        NAME: f.properties?.shapeName ?? f.properties?.NAME ?? f.properties?.name ?? 'Unknown',
      },
    })),
  };

  // Cache for next time
  await setCache(cacheKey, normalized);

  return normalized;
}
