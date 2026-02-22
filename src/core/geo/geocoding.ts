/**
 * Geocoding via Nominatim (OpenStreetMap).
 */

export interface GeocodingResult {
  placeId: number;
  displayName: string;
  shortName: string;
  type: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // [south, north, west, east]
  osmType?: string;
  osmId?: number;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'MapLayoutPro/0.1 (browser-extension)';

/**
 * Search for a place by name.
 */
export async function searchPlace(query: string, limit = 5): Promise<GeocodingResult[]> {
  if (query.length < 2) return [];

  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&polygon_geojson=0`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }

  const data = await response.json();

  return data.map((r: Record<string, unknown>) => ({
    placeId: r.place_id,
    displayName: r.display_name as string,
    shortName: (r.display_name as string).split(',')[0].trim(),
    type: r.type as string,
    lat: parseFloat(r.lat as string),
    lon: parseFloat(r.lon as string),
    bbox: (r.boundingbox as string[]).map(Number) as [number, number, number, number],
    osmType: r.osm_type as string | undefined,
    osmId: r.osm_id ? Number(r.osm_id) : undefined,
  }));
}

/**
 * Reverse geocode: get place name from coordinates.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6&addressdetails=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) return null;

  const r = await response.json();
  if (!r.place_id) return null;

  return {
    placeId: r.place_id,
    displayName: r.display_name,
    shortName: r.display_name.split(',')[0].trim(),
    type: r.type,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    bbox: r.boundingbox.map(Number) as [number, number, number, number],
    osmType: r.osm_type,
    osmId: r.osm_id ? Number(r.osm_id) : undefined,
  };
}
