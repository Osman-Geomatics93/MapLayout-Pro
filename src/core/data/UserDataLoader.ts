/** Parse user-imported geospatial files into GeoJSON */

import JSZip from 'jszip';
import * as toGeoJSON from '@mapbox/togeojson';

export interface ParseResult {
  geojson: GeoJSON.FeatureCollection;
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'Mixed';
}

export async function parseUserFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  switch (ext) {
    case 'geojson':
    case 'json':
      return parseGeoJSON(await file.text());
    case 'kml':
      return parseKML(await file.text());
    case 'kmz':
      return parseKMZ(await file.arrayBuffer());
    case 'gpx':
      return parseGPX(await file.text());
    case 'zip':
      return parseShapefile(await file.arrayBuffer());
    default:
      throw new Error(`Unsupported file format: .${ext}. Supported: GeoJSON, KML, KMZ, GPX, Shapefile (.zip)`);
  }
}

function parseGeoJSON(text: string): ParseResult {
  const parsed = JSON.parse(text);
  let fc: GeoJSON.FeatureCollection;

  if (parsed.type === 'FeatureCollection') {
    fc = parsed;
  } else if (parsed.type === 'Feature') {
    fc = { type: 'FeatureCollection', features: [parsed] };
  } else if (parsed.type && parsed.coordinates) {
    // Raw geometry
    fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: parsed, properties: {} }] };
  } else {
    throw new Error('Invalid GeoJSON: not a FeatureCollection, Feature, or Geometry');
  }

  if (fc.features.length === 0) {
    throw new Error('GeoJSON file contains no features');
  }

  return { geojson: fc, geometryType: detectGeometryType(fc) };
}

function parseKML(text: string): ParseResult {
  const dom = new DOMParser().parseFromString(text, 'text/xml');
  const parseError = dom.querySelector('parsererror');
  if (parseError) throw new Error('Invalid KML: XML parse error');

  const fc = toGeoJSON.kml(dom) as GeoJSON.FeatureCollection;
  if (!fc.features || fc.features.length === 0) {
    throw new Error('KML file contains no features');
  }

  return { geojson: fc, geometryType: detectGeometryType(fc) };
}

async function parseKMZ(buffer: ArrayBuffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
  if (!kmlFile) throw new Error('KMZ archive does not contain a .kml file');

  const kmlText = await zip.files[kmlFile].async('text');
  return parseKML(kmlText);
}

function parseGPX(text: string): ParseResult {
  const dom = new DOMParser().parseFromString(text, 'text/xml');
  const parseError = dom.querySelector('parsererror');
  if (parseError) throw new Error('Invalid GPX: XML parse error');

  const fc = toGeoJSON.gpx(dom) as GeoJSON.FeatureCollection;
  if (!fc.features || fc.features.length === 0) {
    throw new Error('GPX file contains no features');
  }

  return { geojson: fc, geometryType: detectGeometryType(fc) };
}

async function parseShapefile(buffer: ArrayBuffer): Promise<ParseResult> {
  // shpjs default-exports a function
  const shp = (await import('shpjs')).default;
  const result = await shp(buffer) as GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];

  // shpjs may return an array of FeatureCollections if multiple layers exist
  let fc: GeoJSON.FeatureCollection;
  if (Array.isArray(result)) {
    fc = {
      type: 'FeatureCollection',
      features: result.flatMap(c => c.features),
    };
  } else {
    fc = result;
  }

  if (fc.features.length === 0) {
    throw new Error('Shapefile contains no features');
  }

  return { geojson: fc, geometryType: detectGeometryType(fc) };
}

function detectGeometryType(fc: GeoJSON.FeatureCollection): 'Point' | 'LineString' | 'Polygon' | 'Mixed' {
  const types = new Set<string>();

  for (const f of fc.features) {
    if (!f.geometry) continue;
    const t = f.geometry.type;
    if (t === 'Point' || t === 'MultiPoint') types.add('Point');
    else if (t === 'LineString' || t === 'MultiLineString') types.add('LineString');
    else if (t === 'Polygon' || t === 'MultiPolygon') types.add('Polygon');
  }

  if (types.size === 0) return 'Point';
  if (types.size === 1) return types.values().next().value as 'Point' | 'LineString' | 'Polygon';
  return 'Mixed';
}
