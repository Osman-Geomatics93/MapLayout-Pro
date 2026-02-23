/**
 * MapLayout Pro — Designer (Layout Studio)
 *
 * Main orchestration script for the full-tab layout designer.
 * Wires together: MapLibre map, AOI selection, layout engine, export.
 */

import maplibregl from 'maplibre-gl';
import type { MapMouseEvent, GeoJSONSource } from 'maplibre-gl';
import { detectUTMZone } from '@core/geo/projections';
import { computeScaleBar } from '@core/geo/scale';
import { searchPlace, type GeocodingResult } from '@core/geo/geocoding';
import { buildLayoutSVG, computeDefaultOverrides, type LayoutConfig } from '@core/layout/LayoutEngine';
import { exportToPNG, downloadBlob } from '@core/export/PNGExporter';
import { exportToPDF, exportToSVG } from '@core/export/PDFExporter';
import { loadBoundaries, findCountryByName, loadAdminBoundaries, getCountryISO3 } from '@core/data/BoundaryLoader';
import { SearchableDropdown, type DropdownOption } from '@ui/components/SearchableDropdown';
import { BASEMAP_CATALOG, getBasemapById, DEFAULT_BASEMAP_ID, type BasemapDefinition } from '@core/data/basemaps';
import { parseUserFile } from '@core/data/UserDataLoader';
import { getLayerColor } from '@core/data/defaultLayerStyles';
import type { UserDataLayer } from '@core/types/userdata';
import type { LayoutState, ElementOverrides, CustomTextAnnotation, LegendEntry, DrawingAnnotation, DrawingShapeType, ImageAnnotation, BoundaryColorSettings } from '@core/types/layout';
import type { AOISelection, BBox, LngLat } from '@core/types/geo';
import { initLocale, setLocale, t, type Locale, type TranslationStrings } from '@core/i18n/locales';

// ─── Undo / Redo History ─────────────────────────────────────────────

interface HistorySnapshot {
  customTexts: string;
  drawings: string;
  logoImages: string;
  elementOverrides: string;
  fields: string;
  grid: string;
  boundaryColors: string;
}

const history: { stack: HistorySnapshot[]; index: number } = {
  stack: [],
  index: -1,
};
const MAX_HISTORY = 50;

function takeSnapshot(): HistorySnapshot {
  return {
    customTexts: JSON.stringify(state.customTexts),
    drawings: JSON.stringify(state.drawings),
    logoImages: JSON.stringify(state.logoImages?.map(i => ({ ...i, dataUrl: i.dataUrl.slice(0, 50) + '___LOGO_REF___' + i.id }))),
    elementOverrides: JSON.stringify(state.elementOverrides),
    fields: JSON.stringify(state.fields),
    grid: JSON.stringify(state.grid),
    boundaryColors: JSON.stringify(state.boundaryColors),
  };
}

/** Store logos by id so undo/redo doesn't duplicate huge data URLs */
const logoDataUrlCache = new Map<string, string>();

function pushHistory(): void {
  // Cache logo data URLs
  for (const logo of state.logoImages || []) {
    logoDataUrlCache.set(logo.id, logo.dataUrl);
  }
  const snap = takeSnapshot();
  // Discard any redo states
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snap);
  if (history.stack.length > MAX_HISTORY) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
}

function restoreSnapshot(snap: HistorySnapshot): void {
  state.customTexts = JSON.parse(snap.customTexts);
  state.drawings = JSON.parse(snap.drawings);
  const parsedLogos: ImageAnnotation[] = JSON.parse(snap.logoImages);
  // Restore full data URLs from cache
  for (const logo of parsedLogos) {
    if (logo.dataUrl.includes('___LOGO_REF___')) {
      const cached = logoDataUrlCache.get(logo.id);
      if (cached) logo.dataUrl = cached;
    }
  }
  state.logoImages = parsedLogos;
  state.elementOverrides = JSON.parse(snap.elementOverrides);
  state.fields = JSON.parse(snap.fields);
  state.grid = JSON.parse(snap.grid);
  state.boundaryColors = snap.boundaryColors ? JSON.parse(snap.boundaryColors) : undefined;
}

function undo(): void {
  if (history.index <= 0) return;
  history.index--;
  restoreSnapshot(history.stack[history.index]);
  syncUIFromState();
  rebuildSVGOnly();
  updateUndoRedoButtons();
}

function redo(): void {
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  restoreSnapshot(history.stack[history.index]);
  syncUIFromState();
  rebuildSVGOnly();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons(): void {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = history.index <= 0;
  if (redoBtn) redoBtn.disabled = history.index >= history.stack.length - 1;
}

function syncUIFromState(): void {
  // Sync field inputs
  (document.getElementById('field-title') as HTMLInputElement).value = state.fields.title;
  (document.getElementById('field-subtitle') as HTMLInputElement).value = state.fields.subtitle;
  (document.getElementById('field-author') as HTMLInputElement).value = state.fields.author;
  (document.getElementById('field-date') as HTMLInputElement).value = state.fields.date;
  // Sync element visibility
  if (state.elementOverrides) {
    (document.getElementById('el-na-visible') as HTMLInputElement).checked = state.elementOverrides.northArrow.visible;
    (document.getElementById('el-sb-visible') as HTMLInputElement).checked = state.elementOverrides.scaleBar.visible;
    (document.getElementById('el-lg-visible') as HTMLInputElement).checked = state.elementOverrides.legend.visible;
  }
  if (state.grid) {
    (document.getElementById('el-grid-visible') as HTMLInputElement).checked = state.grid.visible;
  }
  // Re-render sidebar lists
  renderCustomTextList();
  renderDrawingList();
  renderLogoList();
}

// ─── Selected Element Tracking ─────────────────────────────────────────

let selectedElementId: string | null = null;
let selectedElementType: 'element' | 'custom-text' | 'drawing' | 'logo-image' | null = null;

function selectElement(id: string, type: typeof selectedElementType): void {
  clearSelection();
  selectedElementId = id;
  selectedElementType = type;
  const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
  if (!svg) return;
  const attr = type === 'element' ? 'data-element'
    : type === 'custom-text' ? 'data-custom-text'
    : type === 'drawing' ? 'data-drawing'
    : 'data-logo-image';
  const el = svg.querySelector(`[${attr}="${id}"]`);
  if (el) el.classList.add('selected');
}

function clearSelection(): void {
  const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
  if (svg) svg.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  selectedElementId = null;
  selectedElementType = null;
}

// ─── State ───────────────────────────────────────────────────────────

const state: LayoutState = {
  template: null as any,
  aoi: null,
  crs: null,
  scaleBar: null,
  fields: {
    title: 'Study Area Map',
    subtitle: '',
    author: '',
    date: new Date().toISOString().slice(0, 10),
    organization: '',
  },
  activeLayers: ['basemap', 'boundaries', 'aoi-boundary'],
  mapView: { center: [20, 5], zoom: 2, bearing: 0, pitch: 0 },
  renderedMaps: { main: null, insetCountry: null, insetState: null },
  elementOverrides: computeDefaultOverrides({ pageWidthMM: 297, pageHeightMM: 210, marginMM: 8 }),
  customTexts: [],
  userLayers: [],
  customLegendEntries: undefined,
  drawings: [],
  logoImages: [],
  grid: {
    visible: false,
    color: '#333333',
    opacity: 0.4,
    lineWidth: 0.08,
    labelSize: 1.6,
    labelColor: '#333333',
    labelPlacement: 'inside',
  },
  boundaryColors: {
    aoiFill: '#2563eb',
    aoiFillOpacity: 0.15,
    aoiStroke: '#2563eb',
    aoiStrokeWidth: 2,
    countryStroke: '#888888',
    countryStrokeWidth: 0.8,
  },
};

let countriesGeoJSON: GeoJSON.FeatureCollection | null = null;
let map: maplibregl.Map;
let layoutSVG: SVGSVGElement | null = null;

// Admin boundary selector state
let countrySelector: SearchableDropdown;
let stateSelector: SearchableDropdown;
let districtSelector: SearchableDropdown;
let cachedAdminStates: GeoJSON.FeatureCollection | null = null;
let cachedAdminDistricts: GeoJSON.FeatureCollection | null = null;
let currentCountryISO3: string | null = null;
let currentStateName: string | null = null;

// Basemap selector state
let basemapSelector: SearchableDropdown;
let currentBasemapId: string = DEFAULT_BASEMAP_ID;

// Parent boundaries for inset map captures
let parentCountryBBox: BBox | null = null;
let parentStateBBox: BBox | null = null;
let parentCountryName: string | null = null;
let parentStateName: string | null = null;
let parentCountryGeometry: GeoJSON.Geometry | null = null;
let parentStateGeometry: GeoJSON.Geometry | null = null;

// Page dimensions (A4 landscape by default)
let pageConfig: LayoutConfig = {
  pageWidthMM: 297,
  pageHeightMM: 210,
  marginMM: 8,
};

// Per-frame zoom offsets (added/subtracted from auto-computed zoom level)
const mapFrameZoomOffsets = { main: 0, insetCountry: 0, insetState: 0 };

// Per-frame pan offsets (fraction of visible extent: 0.1 = 10% shift)
const mapFramePanOffsets = {
  main: { x: 0, y: 0 },
  insetCountry: { x: 0, y: 0 },
  insetState: { x: 0, y: 0 },
};

// ─── Map Initialization ──────────────────────────────────────────────

async function initMap(): Promise<void> {
  const defaultBasemap = getBasemapById(DEFAULT_BASEMAP_ID)!;
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      name: 'MapLayout Basemap',
      sources: {
        'basemap-source': buildBasemapSource(defaultBasemap),
      },
      layers: [
        {
          id: 'basemap-layer',
          type: 'raster',
          source: 'basemap-source',
          minzoom: defaultBasemap.minzoom,
          maxzoom: defaultBasemap.maxzoom,
        },
      ],
    },
    center: [20, 5] as [number, number],
    zoom: 2,
    preserveDrawingBuffer: true, // Required for canvas export
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

  await new Promise<void>((resolve) => map.on('load', resolve));

  // Load and add country boundaries
  updateStatus('Loading country boundaries...');
  countriesGeoJSON = await loadBoundaries('admin0_110m');

  map.addSource('countries', {
    type: 'geojson',
    data: countriesGeoJSON,
  });

  // Country fill (transparent, for click detection)
  map.addLayer({
    id: 'countries-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': '#000000',
      'fill-opacity': 0,
    },
  });

  // Country borders
  map.addLayer({
    id: 'countries-border',
    type: 'line',
    source: 'countries',
    paint: {
      'line-color': '#888888',
      'line-width': 0.8,
    },
  });

  // Highlighted AOI source + layer
  map.addSource('aoi', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'aoi-fill',
    type: 'fill',
    source: 'aoi',
    paint: {
      'fill-color': '#2563eb',
      'fill-opacity': 0.15,
    },
  });

  map.addLayer({
    id: 'aoi-border',
    type: 'line',
    source: 'aoi',
    paint: {
      'line-color': '#2563eb',
      'line-width': 2,
    },
  });

  // Click handler: select country
  map.on('click', 'countries-fill', handleCountryClick);

  // Hover cursor
  map.on('mouseenter', 'countries-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'countries-fill', () => {
    map.getCanvas().style.cursor = '';
  });

  updateStatus('Ready. Click a country on the map.');
}

// ─── AOI Selection ───────────────────────────────────────────────────

function handleCountryClick(e: MapMouseEvent): void {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['countries-fill'],
  });

  if (!features.length) return;

  const feature = features[0];
  const name = feature.properties?.NAME || feature.properties?.ADMIN || 'Unknown';

  // Find full geometry from GeoJSON (rendered features may be clipped)
  const fullFeature = countriesGeoJSON
    ? findCountryByName(countriesGeoJSON, name)
    : null;

  // Sync with admin dropdown (triggers cascade)
  const iso3 = fullFeature ? getCountryISO3(fullFeature) : (feature.properties?.ISO_A3 as string || '-99');
  syncCountryClickToDropdown(iso3);
}

// Guard: the idle callback reference so we can cancel stale ones
let pendingRenderCallback: (() => void) | null = null;

function selectAOI(aoi: AOISelection): void {
  state.aoi = aoi;

  // Reset per-frame zoom/pan offsets for the new AOI
  mapFrameZoomOffsets.main = 0;
  mapFrameZoomOffsets.insetCountry = 0;
  mapFrameZoomOffsets.insetState = 0;
  mapFramePanOffsets.main = { x: 0, y: 0 };
  mapFramePanOffsets.insetCountry = { x: 0, y: 0 };
  mapFramePanOffsets.insetState = { x: 0, y: 0 };

  // Update AOI layer on map
  (map.getSource('aoi') as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: aoi.geometry, properties: {} }],
  });

  // Fly to AOI
  const padding = 60;
  map.fitBounds(
    [[aoi.bbox.west, aoi.bbox.south], [aoi.bbox.east, aoi.bbox.north]],
    { padding, duration: 1500 }
  );

  // Detect CRS
  state.crs = detectUTMZone(aoi.centroid);

  // Update UI
  updateAOIStatus(aoi);
  updateStatus(`Selected: ${aoi.name}`);

  // Update title if default
  const titleInput = document.getElementById('field-title') as HTMLInputElement;
  if (titleInput.value === 'Study Area Map' || titleInput.value === '') {
    titleInput.value = `Study Area: ${aoi.name}`;
    state.fields.title = titleInput.value;
  }

  // Cancel any previous pending render so we don't get concurrent captures
  if (pendingRenderCallback) {
    map.off('idle', pendingRenderCallback);
    pendingRenderCallback = null;
  }

  // Wait for map to finish moving, then render preview
  pendingRenderCallback = () => {
    pendingRenderCallback = null;
    renderLayoutPreview();
  };
  map.once('idle', pendingRenderCallback);
}

// ─── Layout Preview ──────────────────────────────────────────────────

let renderInProgress = false;
let renderQueued = false;

async function renderLayoutPreview(): Promise<void> {
  // Prevent concurrent renders — queue re-render if one is in progress
  if (renderInProgress) {
    renderQueued = true;
    return;
  }
  renderInProgress = true;
  updateStatus('Rendering layout preview...');

  // Capture main map (with zoom offset applied)
  const mainCapture = await captureMapImage();
  state.renderedMaps.main = mainCapture.dataUrl;
  state.mainMapBBox = mainCapture.bounds;

  // Capture inset maps (with zoom offsets applied inside)
  state.renderedMaps.insetCountry = await captureInsetMap('country');
  state.renderedMaps.insetState = await captureInsetMap('state');

  // Compute scale bar at the actual capture zoom (includes offset)
  const mapCenter: LngLat = {
    lng: map.getCenter().lng,
    lat: map.getCenter().lat,
  };
  const mainFrameWidthPx = map.getCanvas().width;
  const mainFrameWidthMM = pageConfig.pageWidthMM - pageConfig.marginMM * 2 - 55;
  state.scaleBar = computeScaleBar(mapCenter, mainCapture.captureZoom, mainFrameWidthPx, mainFrameWidthMM);

  // Read fields from UI
  readFieldsFromUI();
  readOverridesFromUI(); // sync visibility checkboxes

  // Set inset labels based on current admin selection level
  const aoiLevel = state.aoi?.adminLevel ?? 0;
  state.insetLabels = {
    country: aoiLevel >= 1 && parentCountryName ? parentCountryName : 'Country Overview',
    state: aoiLevel >= 2 && parentStateName
      ? parentStateName
      : aoiLevel >= 1 && parentCountryName
        ? parentCountryName
        : 'Regional Overview',
  };

  // Build SVG layout
  layoutSVG = buildLayoutSVG(state, pageConfig);

  // Display in preview
  const host = document.getElementById('layout-svg-host')!;
  host.innerHTML = '';

  // Scale the preview to fit nicely
  const previewScale = 2.5; // px per mm
  host.style.width = `${pageConfig.pageWidthMM * previewScale}px`;
  host.style.height = `${pageConfig.pageHeightMM * previewScale}px`;

  layoutSVG.setAttribute('width', '100%');
  layoutSVG.setAttribute('height', '100%');
  host.appendChild(layoutSVG);

  // Attach drag handlers for interactive element positioning
  attachDragHandlers();
  renderCustomTextList();
  renderDrawingList();
  renderLogoList();

  updateStatus('Layout preview ready. Drag elements to reposition. Double-click to add text.');

  renderInProgress = false;

  // If another render was requested while we were busy, run it now
  if (renderQueued) {
    renderQueued = false;
    renderLayoutPreview();
  }
}

/** Capture the current map view as a data URL, applying main map zoom + pan offsets */
async function captureMapImage(): Promise<{ dataUrl: string; captureZoom: number; bounds: { west: number; south: number; east: number; north: number } }> {
  const zoomOffset = mapFrameZoomOffsets.main;
  const pan = mapFramePanOffsets.main;
  const savedCenter = map.getCenter();
  const savedZoom = map.getZoom();
  const captureZoom = savedZoom + zoomOffset;
  const needsAdjust = zoomOffset !== 0 || pan.x !== 0 || pan.y !== 0;

  if (needsAdjust) {
    map.setZoom(captureZoom);
    // Apply pan offset as fraction of visible extent
    if (pan.x !== 0 || pan.y !== 0) {
      const bounds = map.getBounds();
      const lngSpan = bounds.getEast() - bounds.getWest();
      const latSpan = bounds.getNorth() - bounds.getSouth();
      map.setCenter([
        map.getCenter().lng + pan.x * lngSpan,
        map.getCenter().lat + pan.y * latSpan,
      ]);
    }
    await waitForMapIdle();
  }

  map.triggerRepaint();
  await new Promise<void>(r => map.once('idle', () => r()));

  // Capture the geographic bounds visible at this moment
  const captureBounds = map.getBounds();
  const bounds: BBox = {
    west: captureBounds.getWest(),
    south: captureBounds.getSouth(),
    east: captureBounds.getEast(),
    north: captureBounds.getNorth(),
  };

  const dataUrl = map.getCanvas().toDataURL('image/png');

  if (needsAdjust) {
    map.jumpTo({ center: savedCenter, zoom: savedZoom });
    await waitForMapIdle();
  }

  return { dataUrl, captureZoom, bounds };
}

/**
 * Capture an inset map by temporarily swapping the map view and AOI layers.
 *
 * Logic depends on the AOI admin level:
 *
 * AOI = district (ADM2):
 *   Country inset → country boundary (blue) + red box at district
 *   State inset   → state boundary (blue) + red box at district
 *   Main map      → district zoomed in
 *
 * AOI = state (ADM1):
 *   Country inset → country boundary (blue) + red box at state
 *   State inset   → wider regional view around the state
 *   Main map      → state zoomed in
 *
 * AOI = country (ADM0):
 *   Country inset → wide continental zoom out
 *   State inset   → country with some context
 *   Main map      → country zoomed in
 */
async function captureInsetMap(level: 'country' | 'state'): Promise<string | null> {
  if (!state.aoi) return null;

  const aoiLevel = state.aoi.adminLevel ?? 0;

  // Save current view
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  // Decide: which geometry to show in the blue AOI fill, and what extent to zoom to
  let swapGeometry: GeoJSON.Geometry | null = null; // null = don't swap, keep AOI
  let targetBBox: BBox;
  let showExtentBox = false; // show red indicator box at study area location

  if (level === 'country') {
    if (aoiLevel >= 1 && parentCountryGeometry && parentCountryBBox) {
      // AOI is state or district → show country boundary + extent indicator
      swapGeometry = parentCountryGeometry;
      showExtentBox = true;
      const span = padBBox(parentCountryBBox, 0.15);
      targetBBox = span;
    } else {
      // AOI IS the country → just zoom way out for continental context
      const b = state.aoi.bbox;
      targetBBox = padBBox(b, 2.0);
    }
  } else {
    // State/Regional inset
    if (aoiLevel >= 2 && parentStateGeometry && parentStateBBox) {
      // AOI is district → show state boundary + extent indicator
      swapGeometry = parentStateGeometry;
      showExtentBox = true;
      targetBBox = padBBox(parentStateBBox, 0.15);
    } else if (aoiLevel >= 1 && parentCountryGeometry && parentCountryBBox) {
      // AOI is state → show country boundary + extent indicator at state
      swapGeometry = parentCountryGeometry;
      showExtentBox = true;
      targetBBox = padBBox(parentCountryBBox, 0.05);
    } else {
      // AOI is country or no parent data → regional zoom around AOI
      const b = state.aoi.bbox;
      targetBBox = padBBox(b, 0.5);
    }
  }

  // --- Temporarily swap AOI layer ---
  const aoiSource = map.getSource('aoi') as GeoJSONSource;
  const originalAOIData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: state.aoi.geometry, properties: {} }],
  };

  if (swapGeometry) {
    // Show the parent boundary as the blue AOI
    aoiSource.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: swapGeometry, properties: {} }],
    });

    // Boost AOI opacity so the parent boundary is clearly visible in the small inset
    map.setPaintProperty('aoi-fill', 'fill-opacity', 0.25);
    map.setPaintProperty('aoi-border', 'line-width', 2.5);
  }

  // Add red extent indicator showing the study area location within the parent
  if (showExtentBox) {
    // Clean up any leftover extent-indicator from a previous capture
    if (map.getLayer('extent-indicator-border')) map.removeLayer('extent-indicator-border');
    if (map.getLayer('extent-indicator-fill')) map.removeLayer('extent-indicator-fill');
    if (map.getLayer('extent-indicator-point')) map.removeLayer('extent-indicator-point');
    if (map.getSource('extent-indicator')) map.removeSource('extent-indicator');

    // Use the actual AOI geometry (not bbox rectangle) so the red area
    // precisely covers the study area shape — avoids misplacement from
    // MultiPolygon exclaves/islands that skew the bounding box.
    const extentFeatures: GeoJSON.Feature[] = [
      { type: 'Feature', geometry: state.aoi.geometry, properties: {} },
    ];

    // Also add a center point marker so the location is visible even when
    // the geometry is too small to see at the parent zoom level.
    extentFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [state.aoi.centroid.lng, state.aoi.centroid.lat],
      },
      properties: {},
    });

    map.addSource('extent-indicator', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: extentFeatures },
    });
    map.addLayer({
      id: 'extent-indicator-fill',
      type: 'fill',
      source: 'extent-indicator',
      paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.4 },
    });
    map.addLayer({
      id: 'extent-indicator-border',
      type: 'line',
      source: 'extent-indicator',
      paint: { 'line-color': '#dc2626', 'line-width': 2.5 },
    });
    map.addLayer({
      id: 'extent-indicator-point',
      type: 'circle',
      source: 'extent-indicator',
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-color': '#dc2626',
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }

  // Move map to inset view (without animation)
  map.fitBounds(
    [[targetBBox.west, targetBBox.south], [targetBBox.east, targetBBox.north]],
    { duration: 0, padding: 10 }
  );

  // Apply user zoom offset for this inset
  const insetKey = level === 'country' ? 'insetCountry' as const : 'insetState' as const;
  if (mapFrameZoomOffsets[insetKey] !== 0) {
    map.setZoom(map.getZoom() + mapFrameZoomOffsets[insetKey]);
  }

  // Apply user pan offset for this inset
  const pan = mapFramePanOffsets[insetKey];
  if (pan.x !== 0 || pan.y !== 0) {
    const bounds = map.getBounds();
    const lngSpan = bounds.getEast() - bounds.getWest();
    const latSpan = bounds.getNorth() - bounds.getSouth();
    map.setCenter([
      map.getCenter().lng + pan.x * lngSpan,
      map.getCenter().lat + pan.y * latSpan,
    ]);
  }

  console.log(`[Inset ${level}] swapGeometry=${!!swapGeometry}, extentBox=${showExtentBox}, aoiLevel=${aoiLevel}, zoomOffset=${mapFrameZoomOffsets[insetKey]}, zoom→${map.getZoom().toFixed(1)}`);

  // Wait for the full render pipeline: tiles + GeoJSON source re-tiling + paint
  await waitForFullRender();

  const dataUrl = map.getCanvas().toDataURL('image/png');

  // --- Restore everything ---
  if (showExtentBox) {
    if (map.getLayer('extent-indicator-point')) map.removeLayer('extent-indicator-point');
    if (map.getLayer('extent-indicator-border')) map.removeLayer('extent-indicator-border');
    if (map.getLayer('extent-indicator-fill')) map.removeLayer('extent-indicator-fill');
    if (map.getSource('extent-indicator')) map.removeSource('extent-indicator');
  }

  // Restore AOI opacity back to normal
  if (swapGeometry) {
    map.setPaintProperty('aoi-fill', 'fill-opacity', 0.15);
    map.setPaintProperty('aoi-border', 'line-width', 2);
  }

  aoiSource.setData(originalAOIData);
  map.jumpTo({ center: currentCenter, zoom: currentZoom });
  await waitForFullRender();

  console.log(`[Inset ${level}] captured ${dataUrl.length} chars`);
  return dataUrl;
}

/** Expand a BBox by a fraction of its span in each direction */
function padBBox(b: BBox, fraction: number): BBox {
  const latSpan = b.north - b.south;
  const lngSpan = b.east - b.west;
  return {
    west: b.west - lngSpan * fraction,
    south: b.south - latSpan * fraction,
    east: b.east + lngSpan * fraction,
    north: b.north + latSpan * fraction,
  };
}

/** Wait for the map to finish rendering all sources and layers */
function waitForMapIdle(): Promise<void> {
  return new Promise((resolve) => {
    map.triggerRepaint();
    map.once('idle', () => resolve());
  });
}

/**
 * Wait for the map to fully render after source data / view changes.
 *
 * MapLibre's `idle` event can fire before a GeoJSON `setData()` call
 * has been fully processed (tiling happens in a web worker). This
 * helper adds an explicit delay between render cycles so the worker
 * has time to finish, then waits for one more idle to ensure the
 * updated tiles are actually painted to the canvas.
 */
async function waitForFullRender(): Promise<void> {
  // 1st cycle: process any pending tile loads / paint calls
  map.triggerRepaint();
  await new Promise<void>(r => map.once('idle', () => r()));

  // Explicit delay — gives the GeoJSON worker time to re-tile the new
  // data and for the GPU to composite. 350ms is enough even for large
  // country-level MultiPolygons.
  await new Promise(r => setTimeout(r, 350));

  // 2nd cycle: render the tiles produced during the delay
  map.triggerRepaint();
  await new Promise<void>(r => map.once('idle', () => r()));
}

// ─── Geocoding Search ────────────────────────────────────────────────

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const toolbarSearch = document.getElementById('toolbar-search') as HTMLInputElement;
const toolbarResults = document.getElementById('toolbar-search-results') as HTMLUListElement;

toolbarSearch.addEventListener('input', () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const query = toolbarSearch.value.trim();
    if (query.length < 2) {
      toolbarResults.classList.add('hidden');
      return;
    }

    try {
      const results = await searchPlace(query);
      renderSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, 400);
});

function renderSearchResults(results: GeocodingResult[]): void {
  toolbarResults.innerHTML = '';

  if (results.length === 0) {
    toolbarResults.innerHTML = '<li>No results found</li>';
    toolbarResults.classList.remove('hidden');
    return;
  }

  for (const r of results) {
    const li = document.createElement('li');
    li.textContent = r.displayName;
    li.addEventListener('click', () => {
      toolbarResults.classList.add('hidden');
      toolbarSearch.value = r.shortName;

      // Fly to result
      const bbox: BBox = {
        south: r.bbox[0],
        north: r.bbox[1],
        west: r.bbox[2],
        east: r.bbox[3],
      };
      const centroid: LngLat = { lng: r.lon, lat: r.lat };

      // Try to find matching country in loaded boundaries
      const countryFeature = countriesGeoJSON
        ? findCountryByName(countriesGeoJSON, r.shortName)
        : null;

      if (countryFeature) {
        const geoBBox = computeBBox(countryFeature.geometry);
        selectAOI({
          type: 'country',
          name: r.shortName,
          geometry: countryFeature.geometry,
          bbox: geoBBox,
          centroid: computeCentroid(geoBBox),
          properties: countryFeature.properties as Record<string, unknown>,
        });
      } else {
        // Use geocoding bbox as AOI
        selectAOI({
          type: 'custom',
          name: r.shortName,
          geometry: bboxToPolygon(bbox),
          bbox,
          centroid,
        });
      }
    });
    toolbarResults.appendChild(li);
  }
  toolbarResults.classList.remove('hidden');
}

// Close search results on outside click
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('.toolbar-center')) {
    toolbarResults.classList.add('hidden');
  }
});

// ─── UI Event Handlers ───────────────────────────────────────────────

// Field inputs → state sync
const fieldTitle = document.getElementById('field-title') as HTMLInputElement;
const fieldSubtitle = document.getElementById('field-subtitle') as HTMLInputElement;
const fieldAuthor = document.getElementById('field-author') as HTMLInputElement;
const fieldDate = document.getElementById('field-date') as HTMLInputElement;

fieldDate.value = state.fields.date;

function readFieldsFromUI(): void {
  state.fields.title = fieldTitle.value;
  state.fields.subtitle = fieldSubtitle.value;
  state.fields.author = fieldAuthor.value;
  state.fields.date = fieldDate.value;
}

// Debounce field changes to re-render preview
let fieldTimeout: ReturnType<typeof setTimeout> | null = null;
[fieldTitle, fieldSubtitle, fieldAuthor, fieldDate].forEach((input) => {
  input.addEventListener('input', () => {
    if (fieldTimeout) clearTimeout(fieldTimeout);
    fieldTimeout = setTimeout(() => {
      if (state.aoi) renderLayoutPreview();
    }, 600);
  });
});

// Layer toggles
document.getElementById('layer-list')!.addEventListener('change', (e) => {
  const checkbox = e.target as HTMLInputElement;
  const layerId = checkbox.dataset.layer;
  if (!layerId) return;

  if (checkbox.checked) {
    if (!state.activeLayers.includes(layerId)) {
      state.activeLayers.push(layerId);
    }
  } else {
    state.activeLayers = state.activeLayers.filter((id) => id !== layerId);
  }

  // Toggle map layer visibility
  const mapLayerIds: Record<string, string[]> = {
    basemap: ['basemap-layer'],
    boundaries: ['countries-fill', 'countries-border'],
  };
  const mapLayers = mapLayerIds[layerId];
  if (mapLayers) {
    const visibility = checkbox.checked ? 'visible' : 'none';
    mapLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
  }

  if (state.aoi) {
    if (fieldTimeout) clearTimeout(fieldTimeout);
    fieldTimeout = setTimeout(() => renderLayoutPreview(), 300);
  }
});

// Draw rectangle AOI
document.getElementById('btn-draw-rect')!.addEventListener('click', () => {
  startRectangleDraw();
});

// Clear AOI
document.getElementById('btn-clear-aoi')!.addEventListener('click', () => {
  state.aoi = null;
  state.crs = null;
  state.scaleBar = null;
  state.renderedMaps = { main: null, insetCountry: null, insetState: null };
  mapFrameZoomOffsets.main = 0;
  mapFrameZoomOffsets.insetCountry = 0;
  mapFrameZoomOffsets.insetState = 0;
  mapFramePanOffsets.main = { x: 0, y: 0 };
  mapFramePanOffsets.insetCountry = { x: 0, y: 0 };
  mapFramePanOffsets.insetState = { x: 0, y: 0 };

  (map.getSource('aoi') as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: [],
  });

  // Reset admin selectors
  if (countrySelector) {
    countrySelector.clear();
    stateSelector.clear();
    stateSelector.setOptions([]);
    stateSelector.setPlaceholder('Select a country first');
    stateSelector.setEnabled(false);
    districtSelector.clear();
    districtSelector.setOptions([]);
    districtSelector.setPlaceholder('Select a state first');
    districtSelector.setEnabled(false);
    currentCountryISO3 = null;
    currentStateName = null;
    cachedAdminStates = null;
    cachedAdminDistricts = null;
    parentCountryBBox = null;
    parentStateBBox = null;
    parentCountryName = null;
    parentStateName = null;
    parentCountryGeometry = null;
    parentStateGeometry = null;
  }

  // Remove admin boundary layers from map
  removeAdminLayers();

  updateAOIStatus(null);
  updateStatus('AOI cleared. Select a new area.');

  const host = document.getElementById('layout-svg-host')!;
  host.innerHTML = '<p style="color:#aaa;text-align:center;margin-top:40px;">Select an area to preview the layout</p>';
});

// Refresh preview
document.getElementById('btn-refresh-preview')!.addEventListener('click', () => {
  if (state.aoi) renderLayoutPreview();
});

// Open layout in new tab
document.getElementById('btn-open-newtab')!.addEventListener('click', () => {
  openPreviewInNewTab();
});

function openPreviewInNewTab(): void {
  if (!layoutSVG) {
    alert('Please select an area and generate a layout first.');
    return;
  }

  const title = state.fields.title || 'Layout Preview';
  const escapedTitle = escapeHtml(title);

  // Build HTML shell with NO SVG and NO inline script.
  // The SVG is inserted as a live DOM clone (avoids XMLSerializer mangling data-URL images).
  // CSP blocks inline JS, so all interactivity is wired from the opener window reference.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapedTitle} — MapLayout Pro</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #374151; font-family: system-ui, -apple-system, sans-serif; overflow: hidden; }
  .viewer-toolbar {
    position: fixed; top: 0; left: 0; right: 0; height: 44px; z-index: 10;
    background: #1f2937; color: #e5e7eb; display: flex; align-items: center;
    padding: 0 16px; gap: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.4);
  }
  .viewer-toolbar .title { font-size: 14px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .viewer-toolbar button {
    background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px;
    padding: 4px 10px; font-size: 13px; cursor: pointer; line-height: 1.4;
  }
  .viewer-toolbar button:hover { background: #4b5563; }
  .viewer-toolbar .zoom-label { font-size: 12px; min-width: 42px; text-align: center; }
  .viewer-area {
    position: absolute; top: 44px; left: 0; right: 0; bottom: 0; overflow: auto;
    display: flex; align-items: center; justify-content: center;
  }
  .svg-wrapper {
    transform-origin: center center; transition: transform .15s ease;
    background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.5); margin: 40px;
  }
  .svg-wrapper svg { display: block; }
  @media print {
    .viewer-toolbar { display: none !important; }
    body { background: #fff !important; overflow: visible !important; }
    .viewer-area { position: static; overflow: visible; }
    .svg-wrapper { box-shadow: none; margin: 0; transform: none !important; }
    .svg-wrapper svg { width: 100%; height: auto; }
  }
</style>
</head>
<body>
<div class="viewer-toolbar">
  <span class="title">${escapedTitle}</span>
  <button id="zoom-out" title="Zoom out (-)">&#8722;</button>
  <span class="zoom-label" id="zoom-label">100%</span>
  <button id="zoom-in" title="Zoom in (+)">+</button>
  <button id="zoom-fit" title="Fit to page (0)">Fit</button>
  <button id="zoom-print" title="Print (Ctrl+P)">Print</button>
</div>
<div class="viewer-area" id="viewer-area">
  <div class="svg-wrapper" id="svg-wrapper"></div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (!newWin) return;

  newWin.addEventListener('load', () => {
    const doc = newWin.document;
    const wrapper = doc.getElementById('svg-wrapper')!;
    const label = doc.getElementById('zoom-label')!;
    const area = doc.getElementById('viewer-area')!;

    // Clone the live SVG node and insert directly — preserves data-URL images
    // without any serialization/re-parsing that can break them.
    const PX_PER_MM = 3.7795; // 96 DPI
    const svgClone = layoutSVG!.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', `${Math.round(pageConfig.pageWidthMM * PX_PER_MM)}`);
    svgClone.setAttribute('height', `${Math.round(pageConfig.pageHeightMM * PX_PER_MM)}`);
    wrapper.appendChild(doc.adoptNode(svgClone));

    let scale = 1;

    function setScale(s: number): void {
      scale = Math.max(0.1, Math.min(s, 5));
      wrapper.style.transform = `scale(${scale})`;
      label.textContent = `${Math.round(scale * 100)}%`;
    }

    function fitToPage(): void {
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      const svgW = parseFloat(svg.getAttribute('width') || '') || svg.viewBox.baseVal.width;
      const svgH = parseFloat(svg.getAttribute('height') || '') || svg.viewBox.baseVal.height;
      const areaW = area.clientWidth - 80;
      const areaH = area.clientHeight - 80;
      setScale(Math.min(areaW / svgW, areaH / svgH, 1));
    }

    doc.getElementById('zoom-in')!.onclick = () => setScale(scale + 0.15);
    doc.getElementById('zoom-out')!.onclick = () => setScale(scale - 0.15);
    doc.getElementById('zoom-fit')!.onclick = fitToPage;
    doc.getElementById('zoom-print')!.onclick = () => newWin.print();

    doc.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') setScale(scale + 0.15);
      else if (e.key === '-') setScale(scale - 0.15);
      else if (e.key === '0') fitToPage();
    });

    fitToPage();
  });
}

// Preview zoom — px per mm (2.5 ≈ 100% on screen)
let previewScale = 2.5;

document.getElementById('zoom-in')!.addEventListener('click', () => {
  setPreviewScale(previewScale + 0.3);
});
document.getElementById('zoom-out')!.addEventListener('click', () => {
  setPreviewScale(previewScale - 0.3);
});
document.getElementById('zoom-fit')!.addEventListener('click', () => {
  fitPreviewToView();
});

function setPreviewScale(newScale: number): void {
  previewScale = Math.round(Math.max(0.5, Math.min(8, newScale)) * 100) / 100;
  updatePreviewZoom();
}

function updatePreviewZoom(): void {
  const host = document.getElementById('layout-svg-host')!;
  host.style.width = `${pageConfig.pageWidthMM * previewScale}px`;
  host.style.height = `${pageConfig.pageHeightMM * previewScale}px`;
  const pct = Math.round((previewScale / 2.5) * 100);
  document.getElementById('zoom-level')!.textContent = `${pct}%`;
}

function fitPreviewToView(): void {
  const scrollEl = document.getElementById('preview-scroll')!;
  const padPx = 40; // padding around the page
  const availW = scrollEl.clientWidth - padPx * 2;
  const availH = scrollEl.clientHeight - padPx * 2;
  const scaleW = availW / pageConfig.pageWidthMM;
  const scaleH = availH / pageConfig.pageHeightMM;
  setPreviewScale(Math.min(scaleW, scaleH));
}

function initPreviewWheelZoom(): void {
  const scrollContainer = document.getElementById('preview-scroll')!;
  scrollContainer.addEventListener('wheel', (e: WheelEvent) => {
    // Ctrl+Wheel only
    if (!e.ctrlKey && !e.metaKey) return;

    // Don't interfere with scalable element resize (plain wheel)
    const target = e.target as Element;
    if (target.closest?.('[data-element="northArrow"], [data-element="legend"]')) return;

    // Ctrl+Scroll over a map frame → zoom that map's content
    const mapFrame = target.closest?.('[data-map-frame]');
    if (mapFrame) {
      e.preventDefault();
      const frameId = mapFrame.getAttribute('data-map-frame')!;
      const key = mapFrameIdToKey(frameId);
      if (key) {
        const delta = e.deltaY > 0 ? -0.3 : 0.3;
        mapFrameZoomOffsets[key] = Math.round(
          Math.max(-5, Math.min(5, mapFrameZoomOffsets[key] + delta)) * 10
        ) / 10;
        const sign = mapFrameZoomOffsets[key] >= 0 ? '+' : '';
        const label = key === 'main' ? 'Main map' : key === 'insetCountry' ? 'Country inset' : 'State inset';
        updateStatus(`${label} zoom: ${sign}${mapFrameZoomOffsets[key].toFixed(1)} — releasing...`);
        debouncedRecaptureFrame(key);
      }
      return;
    }

    // Otherwise → zoom the preview itself
    e.preventDefault();
    const factor = e.deltaY > 0 ? -0.2 : 0.2;
    setPreviewScale(previewScale + factor);
  }, { passive: false });
}

function mapFrameIdToKey(frameId: string): 'main' | 'insetCountry' | 'insetState' | null {
  if (frameId === 'main-map') return 'main';
  if (frameId === 'inset-country') return 'insetCountry';
  if (frameId === 'inset-state') return 'insetState';
  return null;
}

let recaptureTimeout: ReturnType<typeof setTimeout> | null = null;
let recaptureInProgress = false;

function debouncedRecaptureFrame(key: 'main' | 'insetCountry' | 'insetState'): void {
  if (recaptureTimeout) clearTimeout(recaptureTimeout);
  recaptureTimeout = setTimeout(() => {
    recaptureTimeout = null;
    recaptureMapFrame(key);
  }, 600);
}

async function recaptureMapFrame(key: 'main' | 'insetCountry' | 'insetState'): Promise<void> {
  if (!state.aoi || renderInProgress || recaptureInProgress) return;
  recaptureInProgress = true;

  try {
    if (key === 'main') {
      const mainCapture = await captureMapImage();
      state.renderedMaps.main = mainCapture.dataUrl;
      state.mainMapBBox = mainCapture.bounds;

      // Recompute scale bar at the capture zoom
      const mapCenter: LngLat = { lng: map.getCenter().lng, lat: map.getCenter().lat };
      const mainFrameWidthPx = map.getCanvas().width;
      const mainFrameWidthMM = pageConfig.pageWidthMM - pageConfig.marginMM * 2 - 55;
      state.scaleBar = computeScaleBar(mapCenter, mainCapture.captureZoom, mainFrameWidthPx, mainFrameWidthMM);
    } else {
      const level = key === 'insetCountry' ? 'country' as const : 'state' as const;
      const result = await captureInsetMap(level);
      if (key === 'insetCountry') {
        state.renderedMaps.insetCountry = result;
      } else {
        state.renderedMaps.insetState = result;
      }
    }

    rebuildSVGOnly();
    const label = key === 'main' ? 'Main map' : key === 'insetCountry' ? 'Country inset' : 'State inset';
    updateStatus(`${label} zoom adjusted. Ctrl+scroll on maps to zoom.`);
  } finally {
    recaptureInProgress = false;
  }
}

// ─── Export ──────────────────────────────────────────────────────────

const exportModal = document.getElementById('export-modal')!;
const exportProgress = document.getElementById('export-progress')!;
const progressFill = document.getElementById('progress-fill')!;
const progressText = document.getElementById('progress-text')!;

document.getElementById('btn-export')!.addEventListener('click', () => {
  if (!layoutSVG) {
    alert('Please select an area and generate a layout first.');
    return;
  }
  exportModal.classList.remove('hidden');
});

document.getElementById('export-cancel')!.addEventListener('click', () => {
  exportModal.classList.add('hidden');
});

// About modal
const aboutModal = document.getElementById('about-modal')!;
document.getElementById('btn-about')!.addEventListener('click', () => {
  aboutModal.classList.remove('hidden');
});
document.getElementById('about-close')!.addEventListener('click', () => {
  aboutModal.classList.add('hidden');
});
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) aboutModal.classList.add('hidden');
});

document.getElementById('export-confirm')!.addEventListener('click', async () => {
  if (!layoutSVG) return;

  const format = (document.querySelector('input[name="export-format"]:checked') as HTMLInputElement)?.value || 'pdf';
  const dpi = parseInt((document.getElementById('export-dpi') as HTMLSelectElement).value, 10);
  const embedManifest = (document.getElementById('export-manifest') as HTMLInputElement).checked;

  exportProgress.classList.remove('hidden');

  const onProgress = (pct: number, msg: string) => {
    progressFill.style.width = `${pct}%`;
    progressText.textContent = msg;
  };

  try {
    const filename = `${state.fields.title || 'map'}_${state.fields.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Build manifest JSON if needed
    let manifestJSON: string | undefined;
    if (embedManifest && state.aoi) {
      manifestJSON = JSON.stringify({
        manifestVersion: '1.0',
        generatedBy: 'MapLayout Pro v0.1.0',
        generatedAt: new Date().toISOString(),
        aoi: { name: state.aoi.name, type: state.aoi.type, bbox: state.aoi.bbox },
        templateId: 'scientific-study-area-v1',
        mapState: state.mapView,
        activeLayers: state.activeLayers,
        exportSettings: { format, dpi, pageSize: 'A4', orientation: 'landscape' },
      });
    }

    if (format === 'all') {
      // Batch export: PDF + PNG + SVG
      onProgress(10, 'Exporting PDF...');
      const pdfBlob = await exportToPDF(layoutSVG, {
        pageWidthMM: pageConfig.pageWidthMM,
        pageHeightMM: pageConfig.pageHeightMM,
        orientation: 'landscape',
        dpi,
        title: state.fields.title,
        author: state.fields.author,
        manifestJSON,
        onProgress: (p, m) => onProgress(p * 0.4, m),
      });
      downloadBlob(pdfBlob, `${filename}.pdf`);

      onProgress(45, 'Exporting PNG...');
      const pngBlob = await exportToPNG(layoutSVG, {
        dpi,
        pageWidthMM: pageConfig.pageWidthMM,
        pageHeightMM: pageConfig.pageHeightMM,
        onProgress: (p, m) => onProgress(40 + p * 0.4, m),
      });
      downloadBlob(pngBlob, `${filename}.png`);

      onProgress(85, 'Exporting SVG...');
      const svgBlob = exportToSVG(layoutSVG);
      downloadBlob(svgBlob, `${filename}.svg`);
      onProgress(100, 'All formats exported!');
    } else if (format === 'png') {
      const blob = await exportToPNG(layoutSVG, {
        dpi,
        pageWidthMM: pageConfig.pageWidthMM,
        pageHeightMM: pageConfig.pageHeightMM,
        onProgress,
      });
      downloadBlob(blob, `${filename}.png`);
    } else if (format === 'pdf') {
      const blob = await exportToPDF(layoutSVG, {
        pageWidthMM: pageConfig.pageWidthMM,
        pageHeightMM: pageConfig.pageHeightMM,
        orientation: 'landscape',
        dpi,
        title: state.fields.title,
        author: state.fields.author,
        manifestJSON,
        onProgress,
      });
      downloadBlob(blob, `${filename}.pdf`);
    } else if (format === 'svg') {
      onProgress(50, 'Serializing SVG...');
      const blob = exportToSVG(layoutSVG);
      downloadBlob(blob, `${filename}.svg`);
      onProgress(100, 'Done');
    }

    setTimeout(() => {
      exportModal.classList.add('hidden');
      exportProgress.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 1500);
  } catch (err) {
    console.error('Export failed:', err);
    progressText.textContent = `Export failed: ${(err as Error).message}`;
  }
});

// ─── Rectangle Draw Tool ─────────────────────────────────────────────

function startRectangleDraw(): void {
  const drawBtn = document.getElementById('btn-draw-rect')!;
  drawBtn.classList.add('active');
  updateStatus('Click and drag on the map to draw a rectangle AOI');
  map.getCanvas().style.cursor = 'crosshair';

  let startLngLat: maplibregl.LngLat | null = null;
  let drawing = false;

  const onMouseDown = (e: MapMouseEvent) => {
    startLngLat = e.lngLat;
    drawing = true;
  };

  const onMouseMove = (e: MapMouseEvent) => {
    if (!drawing || !startLngLat) return;

    const bbox: BBox = {
      west: Math.min(startLngLat.lng, e.lngLat.lng),
      south: Math.min(startLngLat.lat, e.lngLat.lat),
      east: Math.max(startLngLat.lng, e.lngLat.lng),
      north: Math.max(startLngLat.lat, e.lngLat.lat),
    };

    (map.getSource('aoi') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: bboxToPolygon(bbox),
        properties: {},
      }],
    });
  };

  const onMouseUp = (e: MapMouseEvent) => {
    if (!drawing || !startLngLat) return;
    drawing = false;

    const bbox: BBox = {
      west: Math.min(startLngLat.lng, e.lngLat.lng),
      south: Math.min(startLngLat.lat, e.lngLat.lat),
      east: Math.max(startLngLat.lng, e.lngLat.lng),
      north: Math.max(startLngLat.lat, e.lngLat.lat),
    };

    const centroid = computeCentroid(bbox);

    selectAOI({
      type: 'custom',
      name: `Custom AOI (${centroid.lat.toFixed(2)}°, ${centroid.lng.toFixed(2)}°)`,
      geometry: bboxToPolygon(bbox),
      bbox,
      centroid,
    });

    // Clean up
    map.off('mousedown', onMouseDown);
    map.off('mousemove', onMouseMove);
    map.off('mouseup', onMouseUp);
    map.getCanvas().style.cursor = '';
    drawBtn.classList.remove('active');
    map.dragPan.enable();
  };

  map.dragPan.disable();
  map.on('mousedown', onMouseDown);
  map.on('mousemove', onMouseMove);
  map.on('mouseup', onMouseUp);
}

// ─── Utility Functions ───────────────────────────────────────────────

function computeBBox(geometry: GeoJSON.Geometry): BBox {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;

  function processCoords(coords: number[]): void {
    west = Math.min(west, coords[0]);
    south = Math.min(south, coords[1]);
    east = Math.max(east, coords[0]);
    north = Math.max(north, coords[1]);
  }

  function walk(geom: GeoJSON.Geometry): void {
    switch (geom.type) {
      case 'Point':
        processCoords(geom.coordinates);
        break;
      case 'MultiPoint':
      case 'LineString':
        geom.coordinates.forEach(processCoords);
        break;
      case 'MultiLineString':
      case 'Polygon':
        geom.coordinates.forEach((ring) => ring.forEach(processCoords));
        break;
      case 'MultiPolygon':
        geom.coordinates.forEach((poly) =>
          poly.forEach((ring) => ring.forEach(processCoords))
        );
        break;
      case 'GeometryCollection':
        geom.geometries.forEach(walk);
        break;
    }
  }

  walk(geometry);
  return { west, south, east, north };
}

function computeCentroid(bbox: BBox): LngLat {
  return {
    lng: (bbox.west + bbox.east) / 2,
    lat: (bbox.south + bbox.north) / 2,
  };
}

function bboxToPolygon(bbox: BBox): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [[
      [bbox.west, bbox.south],
      [bbox.east, bbox.south],
      [bbox.east, bbox.north],
      [bbox.west, bbox.north],
      [bbox.west, bbox.south],
    ]],
  };
}

function updateStatus(msg: string): void {
  const indicator = document.getElementById('map-mode');
  if (indicator) {
    indicator.querySelector('span')!.textContent = msg;
  }
}

function updateAOIStatus(aoi: AOISelection | null): void {
  const statusEl = document.getElementById('aoi-status')!;
  if (!aoi) {
    statusEl.innerHTML = '<span class="aoi-placeholder">Click a country on the map or use the dropdowns above</span>';
    return;
  }

  const crsStr = state.crs ? `UTM Zone ${state.crs.zoneNumber}${state.crs.hemisphere}` : '';
  const adminLabel = aoi.adminLevel !== undefined ? `ADM${aoi.adminLevel}` : aoi.type;
  const parentInfo = aoi.parentStateName
    ? ` (${aoi.parentStateName})`
    : aoi.parentCountryISO3
      ? ` (${aoi.parentCountryISO3})`
      : '';

  statusEl.innerHTML = `
    <div class="aoi-name">${escapeHtml(aoi.name)}${escapeHtml(parentInfo)}</div>
    <div class="aoi-details">
      Level: ${adminLabel} | ${crsStr}<br>
      Bounds: ${aoi.bbox.south.toFixed(2)}° – ${aoi.bbox.north.toFixed(2)}°N,
      ${aoi.bbox.west.toFixed(2)}° – ${aoi.bbox.east.toFixed(2)}°E
    </div>
  `;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Drag & Drop on SVG Preview ───────────────────────────────────────

let isDragging = false;

function screenToSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

function parseTranslate(el: SVGElement): { x: number; y: number } {
  const t = el.getAttribute('transform') || '';
  const m = t.match(/translate\(\s*([^,\s]+)[,\s]+([^)]+)\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

function startElementDrag(e: MouseEvent, el: SVGElement, svg: SVGSVGElement): void {
  // Check if element is locked
  const ctId = el.getAttribute('data-custom-text');
  const logoId = el.getAttribute('data-logo-image');
  if (ctId) {
    const ct = state.customTexts?.find(t => t.id === ctId);
    if (ct?.locked) return;
  }
  if (logoId) {
    const img = state.logoImages?.find(i => i.id === logoId);
    if (img?.locked) return;
  }

  e.preventDefault();
  e.stopPropagation();
  isDragging = true;

  const startSVG = screenToSVGPoint(svg, e.clientX, e.clientY);
  const origin = parseTranslate(el);
  el.classList.add('dragging');

  const onMove = (ev: MouseEvent) => {
    const cur = screenToSVGPoint(svg, ev.clientX, ev.clientY);
    let nx = origin.x + (cur.x - startSVG.x);
    let ny = origin.y + (cur.y - startSVG.y);

    // Snap to page guides (margins, center, edges)
    const snapThreshold = 1.5; // mm
    const guides = getSnapGuides();
    let snappedX = false, snappedY = false;
    for (const gx of guides.vertical) {
      if (Math.abs(nx - gx) < snapThreshold) { nx = gx; snappedX = true; break; }
    }
    for (const gy of guides.horizontal) {
      if (Math.abs(ny - gy) < snapThreshold) { ny = gy; snappedY = true; break; }
    }
    showSnapGuides(snappedX ? nx : null, snappedY ? ny : null);

    el.setAttribute('transform', `translate(${nx},${ny})`);
  };

  const onUp = (ev: MouseEvent) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    el.classList.remove('dragging');
    hideSnapGuides();

    const final = screenToSVGPoint(svg, ev.clientX, ev.clientY);
    const nx = origin.x + (final.x - startSVG.x);
    const ny = origin.y + (final.y - startSVG.y);

    // Save position to state
    const elementId = el.getAttribute('data-element');
    const customTextId = el.getAttribute('data-custom-text');

    if (elementId && state.elementOverrides) {
      const entry = state.elementOverrides[elementId as keyof ElementOverrides];
      if ('position' in entry) {
        entry.position.x = nx;
        entry.position.y = ny;
      }
    } else if (customTextId) {
      const ct = state.customTexts?.find(t => t.id === customTextId);
      if (ct) {
        ct.position.x = nx;
        ct.position.y = ny;
      }
    }

    const logoImageId = el.getAttribute('data-logo-image');
    if (logoImageId) {
      const img = state.logoImages?.find(i => i.id === logoImageId);
      if (img) {
        img.position.x = nx;
        img.position.y = ny;
      }
    }

    // Brief delay so the click event from mouseup doesn't trigger dblclick
    setTimeout(() => { isDragging = false; }, 100);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/** Drag a drawing shape (moves x1/y1/x2/y2 by delta) */
function startDrawingDrag(e: MouseEvent, el: SVGElement, svg: SVGSVGElement): void {
  const drawId = el.getAttribute('data-drawing')!;
  const d = state.drawings?.find(d => d.id === drawId);
  if (!d) return;
  if (d.locked) return;

  e.preventDefault();
  e.stopPropagation();
  isDragging = true;

  const startSVG = screenToSVGPoint(svg, e.clientX, e.clientY);
  const origX1 = d.x1, origY1 = d.y1, origX2 = d.x2, origY2 = d.y2;
  el.classList.add('dragging');

  const onMove = (ev: MouseEvent) => {
    const cur = screenToSVGPoint(svg, ev.clientX, ev.clientY);
    const dx = cur.x - startSVG.x;
    const dy = cur.y - startSVG.y;
    d.x1 = origX1 + dx;
    d.y1 = origY1 + dy;
    d.x2 = origX2 + dx;
    d.y2 = origY2 + dy;
    // Live visual update without full rebuild — shift the group via transform
    // Find the element in the current SVG (may be same or rebuilt)
    const currentEl = svg.querySelector(`[data-drawing="${drawId}"]`);
    if (currentEl) {
      currentEl.setAttribute('transform', `translate(${dx},${dy})`);
    }
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    // Commit the final position with a full rebuild
    rebuildSVGOnly();
    renderDrawingList();
    setTimeout(() => { isDragging = false; }, 100);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/** Get map frame dimensions in mm for pan fraction calculation */
function getFrameDimsMM(frameId: string): { w: number; h: number } {
  if (frameId === 'main-map') {
    return {
      w: pageConfig.pageWidthMM - pageConfig.marginMM * 2 - 55,
      h: pageConfig.pageHeightMM - pageConfig.marginMM * 2 - 30,
    };
  }
  return { w: 42, h: 38 }; // both inset frames
}

/** Drag-to-pan a map frame's content */
function startMapFramePan(e: MouseEvent, frameEl: SVGElement, svg: SVGSVGElement): void {
  e.preventDefault();
  e.stopPropagation();

  const frameId = frameEl.getAttribute('data-map-frame')!;
  const key = mapFrameIdToKey(frameId);
  if (!key) return;

  const dims = getFrameDimsMM(frameId);
  const startSVG = screenToSVGPoint(svg, e.clientX, e.clientY);
  let moved = false;
  svg.style.cursor = 'grabbing';

  const onMove = (ev: MouseEvent) => {
    moved = true;
    const cur = screenToSVGPoint(svg, ev.clientX, ev.clientY);
    const dxMM = cur.x - startSVG.x;
    const dyMM = cur.y - startSVG.y;
    const label = key === 'main' ? 'Main map' : key === 'insetCountry' ? 'Country inset' : 'State inset';
    updateStatus(`Panning ${label}... (${dxMM > 0 ? '→' : '←'} ${dyMM > 0 ? '↓' : '↑'})`);
  };

  const onUp = (ev: MouseEvent) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    svg.style.cursor = '';

    if (!moved) return; // click without drag — ignore

    const final = screenToSVGPoint(svg, ev.clientX, ev.clientY);
    const dxMM = final.x - startSVG.x;
    const dyMM = final.y - startSVG.y;

    // Convert drag to pan fraction
    // Drag right → content slides right → center moves left (west) → negative x offset
    // Drag down → content slides down → center moves up (north) → positive y offset
    mapFramePanOffsets[key].x -= dxMM / dims.w;
    mapFramePanOffsets[key].y += dyMM / dims.h;

    recaptureMapFrame(key);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function attachDragHandlers(): void {
  const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
  if (!svg) return;

  // Make layout elements draggable
  svg.querySelectorAll('[data-element]').forEach(el => {
    el.addEventListener('mousedown', (e) => startElementDrag(e as MouseEvent, el as SVGElement, svg));
  });

  // Make custom text draggable + clickable for editing
  svg.querySelectorAll('[data-custom-text]').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      startElementDrag(e as MouseEvent, el as SVGElement, svg);
    });
    el.addEventListener('click', (e) => {
      if (isDragging) return;
      e.stopPropagation();
      const ctId = el.getAttribute('data-custom-text')!;
      showTextEditPopup(ctId, e as MouseEvent);
    });
  });

  // Make logo images draggable + clickable for editing
  svg.querySelectorAll('[data-logo-image]').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      startElementDrag(e as MouseEvent, el as SVGElement, svg);
    });
    el.addEventListener('click', (e) => {
      if (isDragging) return;
      e.stopPropagation();
      const logoId = el.getAttribute('data-logo-image')!;
      showLogoEditPopup(logoId, e as MouseEvent);
    });
  });

  // Make drawings draggable + clickable for editing
  svg.querySelectorAll('[data-drawing]').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      if (activeDrawTool) return; // Don't drag while drawing
      startDrawingDrag(e as MouseEvent, el as SVGElement, svg);
    });
    el.addEventListener('click', (e) => {
      if (isDragging || activeDrawTool) return;
      e.stopPropagation();
      const drawId = el.getAttribute('data-drawing')!;
      showDrawingEditPopup(drawId, e as MouseEvent);
    });
  });

  // Drag on map frames → pan map content (disabled during drawing mode)
  svg.querySelectorAll('[data-map-frame]').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      if (activeDrawTool) return; // Drawing mode takes priority
      const me = e as MouseEvent;
      // Don't hijack clicks on draggable layout elements, custom text, or drawings inside the frame
      const target = me.target as Element;
      if (target.closest('[data-element]') || target.closest('[data-custom-text]') || target.closest('[data-drawing]') || target.closest('[data-logo-image]')) return;
      startMapFramePan(me, el as SVGElement, svg);
    });
  });

  // Double-click on empty SVG area → add text
  svg.addEventListener('dblclick', (e: MouseEvent) => {
    if (isDragging || activeDrawTool) return;
    // Don't trigger if clicking on an existing element
    const target = e.target as Element;
    if (target.closest('[data-element]') || target.closest('[data-custom-text]') || target.closest('[data-drawing]') || target.closest('[data-logo-image]')) return;

    const pos = screenToSVGPoint(svg, e.clientX, e.clientY);
    addCustomTextAt(pos.x, pos.y);
  });
}

// ─── Custom Text ──────────────────────────────────────────────────────

function addCustomTextAt(x: number, y: number): void {
  const ct: CustomTextAnnotation = {
    id: `ct-${Date.now()}`,
    text: 'Text',
    position: { x, y },
    fontSize: 3,
    color: '#1a1a1a',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontFamily: "'Noto Sans', Arial, sans-serif",
  };
  state.customTexts!.push(ct);
  rebuildSVGOnly();
  renderCustomTextList();
  pushHistory();
  // Auto-open editor for the new text
  setTimeout(() => {
    const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
    if (!svg) return;
    const el = svg.querySelector(`[data-custom-text="${ct.id}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      showTextEditPopup(ct.id, { clientX: rect.left + rect.width / 2, clientY: rect.top } as MouseEvent);
    }
  }, 50);
}

function removeCustomText(id: string): void {
  state.customTexts = state.customTexts!.filter(ct => ct.id !== id);
  hideTextEditPopup();
  clearSelection();
  rebuildSVGOnly();
  renderCustomTextList();
  pushHistory();
}

/** Rebuild SVG without recapturing map images (fast, for drag/text changes) */
function rebuildSVGOnly(): void {
  readFieldsFromUI();
  layoutSVG = buildLayoutSVG(state, pageConfig);
  const host = document.getElementById('layout-svg-host')!;
  host.innerHTML = '';
  host.style.width = `${pageConfig.pageWidthMM * previewScale}px`;
  host.style.height = `${pageConfig.pageHeightMM * previewScale}px`;
  layoutSVG.setAttribute('width', '100%');
  layoutSVG.setAttribute('height', '100%');
  host.appendChild(layoutSVG);
  attachDragHandlers();
}

function renderCustomTextList(): void {
  const container = document.getElementById('custom-text-list')!;
  container.innerHTML = '';

  for (const ct of state.customTexts!) {
    const div = document.createElement('div');
    div.className = 'ct-list-item';
    div.innerHTML = `
      <span class="ct-label">${escapeHtml(ct.text)}</span>
      <button class="ct-remove-btn" title="Delete">&times;</button>
    `;
    div.querySelector('.ct-remove-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCustomText(ct.id);
    });
    div.addEventListener('click', () => {
      // Find the element on the SVG and open the editor
      const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
      const el = svg?.querySelector(`[data-custom-text="${ct.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        showTextEditPopup(ct.id, { clientX: rect.left + rect.width / 2, clientY: rect.top } as MouseEvent);
      }
    });
    container.appendChild(div);
  }
}

// ─── Text Edit Popup ──────────────────────────────────────────────────

let activeEditCTId: string | null = null;
const tePopup = document.getElementById('text-edit-popup')!;
const teInput = document.getElementById('te-input') as HTMLInputElement;
const teSize = document.getElementById('te-size') as HTMLInputElement;
const teColor = document.getElementById('te-color') as HTMLInputElement;
const teWeight = document.getElementById('te-weight') as HTMLSelectElement;
const teStyle = document.getElementById('te-style') as HTMLSelectElement;
const teFont = document.getElementById('te-font') as HTMLSelectElement;
const teLock = document.getElementById('te-lock')!;
const teDelete = document.getElementById('te-delete')!;

function showTextEditPopup(ctId: string, e: MouseEvent): void {
  const ct = state.customTexts?.find(t => t.id === ctId);
  if (!ct) return;

  activeEditCTId = ctId;
  selectElement(ctId, 'custom-text');
  teInput.value = ct.text;
  teSize.value = String(ct.fontSize);
  teColor.value = ct.color;
  teWeight.value = ct.fontWeight;
  teStyle.value = ct.fontStyle || 'normal';
  teFont.value = ct.fontFamily || "'Noto Sans', Arial, sans-serif";
  teLock.classList.toggle('locked', !!ct.locked);

  // Position popup near the element
  const x = Math.min(e.clientX, window.innerWidth - 260);
  const y = Math.max(e.clientY - 80, 10);
  tePopup.style.left = `${x}px`;
  tePopup.style.top = `${y}px`;
  tePopup.classList.remove('hidden');

  teInput.focus();
  teInput.select();
}

function hideTextEditPopup(): void {
  tePopup.classList.add('hidden');
  activeEditCTId = null;
}

function applyTextEdit(): void {
  if (!activeEditCTId) return;
  const ct = state.customTexts?.find(t => t.id === activeEditCTId);
  if (!ct) return;

  ct.text = teInput.value;
  ct.fontSize = parseFloat(teSize.value);
  ct.color = teColor.value;
  ct.fontWeight = teWeight.value as 'normal' | 'bold';
  ct.fontStyle = teStyle.value as 'normal' | 'italic';
  ct.fontFamily = teFont.value;

  rebuildSVGOnly();
  renderCustomTextList();
}

teInput.addEventListener('input', applyTextEdit);
teSize.addEventListener('input', applyTextEdit);
teColor.addEventListener('input', applyTextEdit);
teWeight.addEventListener('change', applyTextEdit);
teStyle.addEventListener('change', applyTextEdit);
teFont.addEventListener('change', applyTextEdit);
teLock.addEventListener('click', () => {
  if (!activeEditCTId) return;
  const ct = state.customTexts?.find(t => t.id === activeEditCTId);
  if (ct) {
    ct.locked = !ct.locked;
    teLock.classList.toggle('locked', !!ct.locked);
    rebuildSVGOnly();
    pushHistory();
  }
});
teDelete.addEventListener('click', () => {
  if (activeEditCTId) removeCustomText(activeEditCTId);
});

// Close popup on outside click
document.addEventListener('mousedown', (e) => {
  if (activeEditCTId && !tePopup.contains(e.target as Node)) {
    hideTextEditPopup();
  }
  if (activeEditDrawingId && !dePopup.contains(e.target as Node)) {
    hideDrawingEditPopup();
  }
  if (activeEditLogoId && !lePopup.contains(e.target as Node)) {
    hideLogoEditPopup();
  }
});

// ─── Drawing Tools ────────────────────────────────────────────────────

let activeDrawTool: DrawingShapeType | null = null;
let drawingStart: { x: number; y: number } | null = null;
let rubberBand: HTMLDivElement | null = null;
let activeEditDrawingId: string | null = null;

const dePopup = document.getElementById('drawing-edit-popup')!;
const deStroke = document.getElementById('de-stroke') as HTMLInputElement;
const deStrokeWidth = document.getElementById('de-stroke-width') as HTMLInputElement;
const deFill = document.getElementById('de-fill') as HTMLInputElement;
const deFillOpacity = document.getElementById('de-fill-opacity') as HTMLInputElement;
const deLock = document.getElementById('de-lock')!;
const deDelete = document.getElementById('de-delete')!;

function initDrawingTools(): void {
  const toolBtns = document.querySelectorAll<HTMLButtonElement>('.draw-tool-btn');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.drawTool as DrawingShapeType;
      if (activeDrawTool === tool) {
        // Deactivate
        activeDrawTool = null;
        btn.classList.remove('active');
        document.getElementById('layout-svg-host')!.classList.remove('drawing-mode');
      } else {
        // Activate this tool
        activeDrawTool = tool;
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('layout-svg-host')!.classList.add('drawing-mode');
        hideDrawingEditPopup();
      }
    });
  });

  // Escape key deactivates tool
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeDrawTool) {
      activeDrawTool = null;
      toolBtns.forEach(b => b.classList.remove('active'));
      document.getElementById('layout-svg-host')!.classList.remove('drawing-mode');
      removeRubberBand();
      drawingStart = null;
    }
  });

  // Drawing gesture handlers — use capture phase on the preview scroll area
  // so drawing mode takes priority over map frame pan and other SVG handlers.
  const host = document.getElementById('layout-svg-host')!;
  const previewScroll = document.getElementById('preview-scroll')!;

  // We use capture:true on mousedown so it fires before any SVG element handlers
  previewScroll.addEventListener('mousedown', (e: MouseEvent) => {
    if (!activeDrawTool) return;

    // Only trigger if the click is inside the SVG host area
    const hostEl = document.getElementById('layout-svg-host')!;
    if (!hostEl.contains(e.target as Node)) return;

    const svg = hostEl.querySelector('svg') as SVGSVGElement;
    if (!svg) return;

    // Allow clicks on existing drawings to pass through for dragging when no tool active
    // (already gated by activeDrawTool check above, so all clicks here start drawing)

    e.preventDefault();
    e.stopPropagation();

    const pt = screenToSVGPoint(svg, e.clientX, e.clientY);

    if (activeDrawTool === 'point') {
      const drawing: DrawingAnnotation = {
        id: `dw-${Date.now()}`,
        type: 'point',
        x1: pt.x, y1: pt.y,
        x2: pt.x, y2: pt.y,
        strokeColor: '#e53e3e',
        strokeWidth: 0.5,
        fillColor: '#e53e3e',
        fillOpacity: 0,
      };
      state.drawings!.push(drawing);
      rebuildSVGOnly();
      renderDrawingList();
      return;
    }

    drawingStart = pt;
    // Store the screen position of the start for rubber band
    const hostRect = hostEl.getBoundingClientRect();
    const startScreenX = e.clientX - hostRect.left;
    const startScreenY = e.clientY - hostRect.top;

    // Create rubber-band overlay
    rubberBand = document.createElement('div');
    rubberBand.className = 'rubber-band';
    rubberBand.style.left = `${startScreenX}px`;
    rubberBand.style.top = `${startScreenY}px`;
    rubberBand.style.width = '0px';
    rubberBand.style.height = '0px';
    hostEl.style.position = 'relative';
    hostEl.appendChild(rubberBand);

    // Use document-level move/up so drag works even if mouse leaves the SVG area
    const onMove = (ev: MouseEvent) => {
      if (!rubberBand || !drawingStart) return;
      const curHostRect = hostEl.getBoundingClientRect();
      const curX = ev.clientX - curHostRect.left;
      const curY = ev.clientY - curHostRect.top;

      const left = Math.min(startScreenX, curX);
      const top = Math.min(startScreenY, curY);
      const width = Math.abs(curX - startScreenX);
      const height = Math.abs(curY - startScreenY);

      rubberBand.style.left = `${left}px`;
      rubberBand.style.top = `${top}px`;
      rubberBand.style.width = `${width}px`;
      rubberBand.style.height = `${height}px`;
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!drawingStart || !activeDrawTool) {
        removeRubberBand();
        return;
      }

      const svgNow = hostEl.querySelector('svg') as SVGSVGElement;
      if (!svgNow) { removeRubberBand(); drawingStart = null; return; }

      const endPt = screenToSVGPoint(svgNow, ev.clientX, ev.clientY);
      removeRubberBand();

      // Skip tiny drags (less than 1mm)
      const dx = Math.abs(endPt.x - drawingStart.x);
      const dy = Math.abs(endPt.y - drawingStart.y);
      if (dx < 1 && dy < 1) {
        drawingStart = null;
        return;
      }

      const drawing: DrawingAnnotation = {
        id: `dw-${Date.now()}`,
        type: activeDrawTool,
        x1: drawingStart.x, y1: drawingStart.y,
        x2: endPt.x, y2: endPt.y,
        strokeColor: '#e53e3e',
        strokeWidth: 0.5,
        fillColor: '#e53e3e',
        fillOpacity: 0,
      };
      state.drawings!.push(drawing);
      drawingStart = null;
      rebuildSVGOnly();
      renderDrawingList();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, { capture: true });

  // Wire up drawing edit popup controls
  deStroke.addEventListener('input', applyDrawingEdit);
  deStrokeWidth.addEventListener('input', applyDrawingEdit);
  deFill.addEventListener('input', applyDrawingEdit);
  deFillOpacity.addEventListener('input', applyDrawingEdit);
  deLock.addEventListener('click', () => {
    if (!activeEditDrawingId) return;
    const d = state.drawings?.find(d => d.id === activeEditDrawingId);
    if (d) {
      d.locked = !d.locked;
      deLock.classList.toggle('locked', !!d.locked);
      rebuildSVGOnly();
      pushHistory();
    }
  });
  deDelete.addEventListener('click', () => {
    if (activeEditDrawingId) removeDrawing(activeEditDrawingId);
  });

  renderDrawingList();
}

function removeRubberBand(): void {
  if (rubberBand) {
    rubberBand.remove();
    rubberBand = null;
  }
}

function removeDrawing(id: string): void {
  state.drawings = state.drawings!.filter(d => d.id !== id);
  hideDrawingEditPopup();
  clearSelection();
  rebuildSVGOnly();
  renderDrawingList();
  pushHistory();
}

function renderDrawingList(): void {
  const container = document.getElementById('drawing-list')!;
  container.innerHTML = '';

  const typeLabels: Record<DrawingShapeType, string> = {
    line: 'Line', arrow: 'Arrow', circle: 'Ellipse', point: 'Point', rectangle: 'Rect',
  };

  let counter: Record<string, number> = {};
  for (const d of state.drawings!) {
    counter[d.type] = (counter[d.type] || 0) + 1;
    const div = document.createElement('div');
    div.className = 'drawing-list-item';
    div.innerHTML = `
      <span class="dl-swatch" style="background:${d.strokeColor}"></span>
      <span class="dl-label">${typeLabels[d.type]} #${counter[d.type]}</span>
      <button class="dl-remove-btn" title="Delete">&times;</button>
    `;
    div.querySelector('.dl-remove-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      removeDrawing(d.id);
    });
    div.addEventListener('click', () => {
      const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
      const el = svg?.querySelector(`[data-drawing="${d.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        showDrawingEditPopup(d.id, { clientX: rect.left + rect.width / 2, clientY: rect.top } as MouseEvent);
      }
    });
    container.appendChild(div);
  }
}

function showDrawingEditPopup(drawingId: string, e: MouseEvent): void {
  const d = state.drawings?.find(d => d.id === drawingId);
  if (!d) return;

  activeEditDrawingId = drawingId;
  selectElement(drawingId, 'drawing');
  deStroke.value = d.strokeColor;
  deStrokeWidth.value = String(d.strokeWidth);
  deFill.value = d.fillColor;
  deFillOpacity.value = String(d.fillOpacity);
  deLock.classList.toggle('locked', !!d.locked);

  const x = Math.min(e.clientX, window.innerWidth - 240);
  const y = Math.max(e.clientY - 80, 10);
  dePopup.style.left = `${x}px`;
  dePopup.style.top = `${y}px`;
  dePopup.classList.remove('hidden');
}

function hideDrawingEditPopup(): void {
  dePopup.classList.add('hidden');
  activeEditDrawingId = null;
}

function applyDrawingEdit(): void {
  if (!activeEditDrawingId) return;
  const d = state.drawings?.find(d => d.id === activeEditDrawingId);
  if (!d) return;

  d.strokeColor = deStroke.value;
  d.strokeWidth = parseFloat(deStrokeWidth.value);
  d.fillColor = deFill.value;
  d.fillOpacity = parseFloat(deFillOpacity.value);

  rebuildSVGOnly();
  renderDrawingList();
}

// ─── Logo / Image Overlay ──────────────────────────────────────────────

let activeEditLogoId: string | null = null;
const lePopup = document.getElementById('logo-edit-popup')!;
const leWidth = document.getElementById('le-width') as HTMLInputElement;
const leOpacity = document.getElementById('le-opacity') as HTMLInputElement;
const leLock = document.getElementById('le-lock')!;
const leDelete = document.getElementById('le-delete')!;

function initLogoImport(): void {
  const btn = document.getElementById('btn-add-logo')!;
  const fileInput = document.getElementById('logo-file-input') as HTMLInputElement;

  btn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) {
      handleLogoFile(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // Wire popup controls
  leWidth.addEventListener('input', applyLogoEdit);
  leOpacity.addEventListener('input', applyLogoEdit);
  leLock.addEventListener('click', () => {
    if (!activeEditLogoId) return;
    const logo = state.logoImages?.find(i => i.id === activeEditLogoId);
    if (logo) {
      logo.locked = !logo.locked;
      leLock.classList.toggle('locked', !!logo.locked);
      rebuildSVGOnly();
      pushHistory();
    }
  });
  leDelete.addEventListener('click', () => {
    if (activeEditLogoId) removeLogoImage(activeEditLogoId);
  });
}

function handleLogoFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const widthMM = 30;
      const heightMM = widthMM / aspectRatio;

      const annotation: ImageAnnotation = {
        id: `logo-${Date.now()}`,
        name: file.name,
        dataUrl,
        position: {
          x: pageConfig.pageWidthMM - pageConfig.marginMM - widthMM - 2,
          y: pageConfig.pageHeightMM - pageConfig.marginMM - heightMM - 8,
        },
        widthMM,
        heightMM,
        opacity: 1,
        aspectRatio,
      };

      state.logoImages!.push(annotation);
      rebuildSVGOnly();
      renderLogoList();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function renderLogoList(): void {
  const container = document.getElementById('logo-image-list')!;
  container.innerHTML = '';

  for (const logo of state.logoImages!) {
    const div = document.createElement('div');
    div.className = 'logo-image-item';
    div.innerHTML = `
      <img class="logo-thumb" src="${logo.dataUrl}" alt="${escapeHtml(logo.name)}">
      <span class="logo-name">${escapeHtml(logo.name)}</span>
      <button class="logo-remove-btn" title="Delete">&times;</button>
    `;
    div.querySelector('.logo-remove-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      removeLogoImage(logo.id);
    });
    div.addEventListener('click', () => {
      const svg = document.querySelector('#layout-svg-host svg') as SVGSVGElement;
      const el = svg?.querySelector(`[data-logo-image="${logo.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        showLogoEditPopup(logo.id, { clientX: rect.left + rect.width / 2, clientY: rect.top } as MouseEvent);
      }
    });
    container.appendChild(div);
  }
}

function removeLogoImage(id: string): void {
  state.logoImages = state.logoImages!.filter(i => i.id !== id);
  hideLogoEditPopup();
  clearSelection();
  rebuildSVGOnly();
  renderLogoList();
  pushHistory();
}

function showLogoEditPopup(logoId: string, e: MouseEvent): void {
  const logo = state.logoImages?.find(i => i.id === logoId);
  if (!logo) return;

  activeEditLogoId = logoId;
  selectElement(logoId, 'logo-image');
  leWidth.value = String(Math.round(logo.widthMM));
  leOpacity.value = String(logo.opacity);
  leLock.classList.toggle('locked', !!logo.locked);

  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.max(e.clientY - 80, 10);
  lePopup.style.left = `${x}px`;
  lePopup.style.top = `${y}px`;
  lePopup.classList.remove('hidden');
}

function hideLogoEditPopup(): void {
  lePopup.classList.add('hidden');
  activeEditLogoId = null;
}

function applyLogoEdit(): void {
  if (!activeEditLogoId) return;
  const logo = state.logoImages?.find(i => i.id === activeEditLogoId);
  if (!logo) return;

  logo.widthMM = Math.max(5, Math.min(150, parseFloat(leWidth.value) || 30));
  logo.heightMM = logo.widthMM / logo.aspectRatio;
  logo.opacity = parseFloat(leOpacity.value);

  rebuildSVGOnly();
}

// ─── Wheel Resize (North Arrow / Legend / Logo) ───────────────────────

function initWheelResize(): void {
  const scrollContainer = document.getElementById('preview-scroll')!;
  scrollContainer.addEventListener('wheel', (e: WheelEvent) => {
    // Check if the mouse is over a scalable SVG element using event delegation
    const target = e.target as Element;

    // Logo image resize (scroll wheel)
    const logoEl = target.closest?.('[data-logo-image]');
    if (logoEl) {
      e.preventDefault();
      e.stopPropagation();
      const id = logoEl.getAttribute('data-logo-image')!;
      const img = state.logoImages?.find(i => i.id === id);
      if (img) {
        const delta = e.deltaY > 0 ? -1 : 1;
        img.widthMM = Math.max(5, Math.min(150, img.widthMM + delta));
        img.heightMM = img.widthMM / img.aspectRatio;
        rebuildSVGOnly();
      }
      return;
    }

    const scalableEl = target.closest?.('[data-element="northArrow"], [data-element="legend"]');
    if (!scalableEl) return;

    e.preventDefault();
    e.stopPropagation();

    const elementId = scalableEl.getAttribute('data-element') as 'northArrow' | 'legend';
    const ov = state.elementOverrides!;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const current = ov[elementId].scale;
    ov[elementId].scale = Math.round(Math.max(0.5, Math.min(3.0, current + delta)) * 100) / 100;
    rebuildSVGOnly();
  }, { passive: false });
}

// ─── Legend Editor ─────────────────────────────────────────────────────

function generateLegendEntries(): LegendEntry[] {
  const layerStyles: Record<string, { color: string; type: 'fill' | 'line' | 'circle'; label: string }> = {
    basemap: { color: '#e8edf2', type: 'fill', label: 'Basemap' },
    boundaries: { color: '#888', type: 'line', label: 'Country Boundaries' },
    states: { color: '#aaa', type: 'line', label: 'State Boundaries' },
    'aoi-boundary': { color: '#2563eb', type: 'fill', label: 'Study Area' },
    rivers: { color: '#3b82f6', type: 'line', label: 'Rivers' },
    settlements: { color: '#333', type: 'circle', label: 'Settlements' },
  };

  const entries: LegendEntry[] = [];

  for (const id of state.activeLayers) {
    const style = layerStyles[id];
    if (style) {
      entries.push({
        id: `le-${id}-${Date.now()}`,
        label: style.label,
        color: style.color,
        type: style.type,
        visible: true,
      });
    }
  }

  if (state.userLayers) {
    for (const ul of state.userLayers.filter(l => l.visible)) {
      const type: 'fill' | 'line' | 'circle' =
        ul.geometryType === 'Point' ? 'circle' :
        ul.geometryType === 'LineString' ? 'line' : 'fill';
      entries.push({
        id: `le-${ul.id}-${Date.now()}`,
        label: ul.legendLabel,
        color: ul.color,
        type,
        visible: true,
      });
    }
  }

  return entries;
}

function renderLegendEntryList(): void {
  const container = document.getElementById('legend-entry-list')!;
  container.innerHTML = '';

  const entries = state.customLegendEntries;
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-style:italic;">Auto-generated from layers</div>';
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'legend-entry-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = entry.visible;
    cb.title = 'Visible';
    cb.addEventListener('change', () => {
      entry.visible = cb.checked;
      rebuildSVGOnly();
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = entry.color;
    colorInput.title = 'Color';
    colorInput.addEventListener('input', () => {
      entry.color = colorInput.value;
      rebuildSVGOnly();
    });

    const typeSelect = document.createElement('select');
    for (const t of ['fill', 'line', 'circle'] as const) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === entry.type) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () => {
      entry.type = typeSelect.value as 'fill' | 'line' | 'circle';
      rebuildSVGOnly();
    });

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = entry.label;
    labelInput.title = 'Label';
    labelInput.addEventListener('input', () => {
      entry.label = labelInput.value;
      rebuildSVGOnly();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'legend-entry-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Remove entry';
    deleteBtn.addEventListener('click', () => {
      state.customLegendEntries = state.customLegendEntries!.filter(e => e.id !== entry.id);
      if (state.customLegendEntries.length === 0) {
        state.customLegendEntries = undefined;
      }
      renderLegendEntryList();
      rebuildSVGOnly();
    });

    row.appendChild(cb);
    row.appendChild(colorInput);
    row.appendChild(typeSelect);
    row.appendChild(labelInput);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  }
}

function initLegendEditor(): void {
  document.getElementById('btn-legend-populate')!.addEventListener('click', () => {
    state.customLegendEntries = generateLegendEntries();
    renderLegendEntryList();
    rebuildSVGOnly();
  });

  document.getElementById('btn-legend-add')!.addEventListener('click', () => {
    if (!state.customLegendEntries) {
      state.customLegendEntries = [];
    }
    state.customLegendEntries.push({
      id: `le-custom-${Date.now()}`,
      label: 'New Entry',
      color: '#666666',
      type: 'fill',
      visible: true,
    });
    renderLegendEntryList();
    rebuildSVGOnly();
  });

  document.getElementById('btn-legend-clear')!.addEventListener('click', () => {
    state.customLegendEntries = undefined;
    renderLegendEntryList();
    rebuildSVGOnly();
  });

  renderLegendEntryList();
}

// ─── Element Visibility + Reset ───────────────────────────────────────

function readOverridesFromUI(): void {
  const ov = state.elementOverrides!;
  ov.northArrow.visible = (document.getElementById('el-na-visible') as HTMLInputElement).checked;
  ov.scaleBar.visible = (document.getElementById('el-sb-visible') as HTMLInputElement).checked;
  ov.legend.visible = (document.getElementById('el-lg-visible') as HTMLInputElement).checked;
  state.grid!.visible = (document.getElementById('el-grid-visible') as HTMLInputElement).checked;
}

function readGridSettingsFromUI(): void {
  const g = state.grid!;
  g.visible = (document.getElementById('el-grid-visible') as HTMLInputElement).checked;
  g.color = (document.getElementById('grid-color') as HTMLInputElement).value;
  g.opacity = parseFloat((document.getElementById('grid-opacity') as HTMLInputElement).value);
  g.lineWidth = parseFloat((document.getElementById('grid-line-width') as HTMLInputElement).value);
  g.labelSize = parseFloat((document.getElementById('grid-label-size') as HTMLInputElement).value);
  g.labelColor = (document.getElementById('grid-label-color') as HTMLInputElement).value;
  g.labelPlacement = (document.getElementById('grid-label-placement') as HTMLSelectElement).value as 'inside' | 'outside';

  // Show/hide settings panel
  const panel = document.getElementById('grid-settings')!;
  panel.classList.toggle('hidden', !g.visible);
}

function initElementControls(): void {
  // Visibility toggles → rebuild SVG
  for (const id of ['el-na-visible', 'el-sb-visible', 'el-lg-visible']) {
    document.getElementById(id)!.addEventListener('change', () => {
      readOverridesFromUI();
      rebuildSVGOnly();
    });
  }

  // Grid toggle — also show/hide settings panel
  document.getElementById('el-grid-visible')!.addEventListener('change', () => {
    readOverridesFromUI();
    readGridSettingsFromUI();
    rebuildSVGOnly();
  });

  // Grid settings controls
  for (const id of ['grid-color', 'grid-opacity', 'grid-line-width', 'grid-label-size', 'grid-label-color']) {
    document.getElementById(id)!.addEventListener('input', () => {
      readGridSettingsFromUI();
      rebuildSVGOnly();
    });
  }

  // Grid label placement select
  document.getElementById('grid-label-placement')!.addEventListener('change', () => {
    readGridSettingsFromUI();
    rebuildSVGOnly();
  });

  // Reset positions button
  document.getElementById('btn-reset-positions')!.addEventListener('click', () => {
    state.elementOverrides = computeDefaultOverrides(pageConfig);
    // Sync checkboxes back
    (document.getElementById('el-na-visible') as HTMLInputElement).checked = state.elementOverrides.northArrow.visible;
    (document.getElementById('el-sb-visible') as HTMLInputElement).checked = state.elementOverrides.scaleBar.visible;
    (document.getElementById('el-lg-visible') as HTMLInputElement).checked = state.elementOverrides.legend.visible;
    rebuildSVGOnly();
  });
}

// ─── User Data Import ─────────────────────────────────────────────────

let userLayerCounter = 0;

function initDataImport(): void {
  const dropzone = document.getElementById('data-dropzone')!;
  const fileInput = document.getElementById('data-file-input') as HTMLInputElement;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files.length) {
      handleImportedFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) {
      handleImportedFiles(fileInput.files);
      fileInput.value = '';
    }
  });
}

async function handleImportedFiles(files: FileList): Promise<void> {
  for (const file of Array.from(files)) {
    try {
      updateStatus(`Importing ${file.name}...`);
      const { geojson, geometryType } = await parseUserFile(file);

      const name = file.name.replace(/\.[^.]+$/, '');
      const color = getLayerColor(userLayerCounter++);

      const layer: UserDataLayer = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        geojson,
        geometryType,
        color,
        opacity: 0.7,
        visible: true,
        legendLabel: name,
      };

      state.userLayers!.push(layer);
      addUserLayerToMap(layer);
      renderUserLayerList();
      updateStatus(`Imported "${name}" (${geojson.features.length} features)`);
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err);
      alert(`Failed to import "${file.name}": ${(err as Error).message}`);
      updateStatus('Import failed');
    }
  }
}

function addUserLayerToMap(layer: UserDataLayer): void {
  const sourceId = `user-src-${layer.id}`;

  map.addSource(sourceId, {
    type: 'geojson',
    data: layer.geojson,
  });

  const geoType = layer.geometryType;

  if (geoType === 'Point' || geoType === 'Mixed') {
    map.addLayer({
      id: `user-circle-${layer.id}`,
      type: 'circle',
      source: sourceId,
      filter: geoType === 'Mixed' ? ['in', '$type', 'Point'] : ['all'],
      paint: {
        'circle-color': layer.color,
        'circle-radius': 5,
        'circle-opacity': layer.opacity,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    });
  }

  if (geoType === 'LineString' || geoType === 'Mixed') {
    map.addLayer({
      id: `user-line-${layer.id}`,
      type: 'line',
      source: sourceId,
      filter: geoType === 'Mixed' ? ['in', '$type', 'LineString'] : ['all'],
      paint: {
        'line-color': layer.color,
        'line-width': 2,
        'line-opacity': layer.opacity,
      },
    });
  }

  if (geoType === 'Polygon' || geoType === 'Mixed') {
    map.addLayer({
      id: `user-fill-${layer.id}`,
      type: 'fill',
      source: sourceId,
      filter: geoType === 'Mixed' ? ['in', '$type', 'Polygon'] : ['all'],
      paint: {
        'fill-color': layer.color,
        'fill-opacity': layer.opacity * 0.4,
      },
    });
    map.addLayer({
      id: `user-fill-line-${layer.id}`,
      type: 'line',
      source: sourceId,
      filter: geoType === 'Mixed' ? ['in', '$type', 'Polygon'] : ['all'],
      paint: {
        'line-color': layer.color,
        'line-width': 1.5,
        'line-opacity': layer.opacity,
      },
    });
  }
}

function removeUserLayer(id: string): void {
  // Remove map layers and source
  const suffixes = ['circle', 'line', 'fill', 'fill-line'];
  for (const s of suffixes) {
    const layerId = `user-${s}-${id}`;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  const sourceId = `user-src-${id}`;
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Remove from state
  state.userLayers = state.userLayers!.filter(l => l.id !== id);
  renderUserLayerList();
}

function toggleUserLayerVisibility(id: string): void {
  const layer = state.userLayers!.find(l => l.id === id);
  if (!layer) return;

  layer.visible = !layer.visible;
  const visibility = layer.visible ? 'visible' : 'none';

  const suffixes = ['circle', 'line', 'fill', 'fill-line'];
  for (const s of suffixes) {
    const layerId = `user-${s}-${id}`;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }

  renderUserLayerList();
}

function renderUserLayerList(): void {
  const container = document.getElementById('user-layer-list')!;
  container.innerHTML = '';

  for (const layer of state.userLayers!) {
    const div = document.createElement('div');
    div.className = 'user-layer-item';
    div.innerHTML = `
      <span class="user-layer-color" style="background:${layer.color}" title="Layer color"></span>
      <span class="user-layer-name" title="${escapeHtml(layer.name)}">${escapeHtml(layer.legendLabel)}</span>
      <button class="user-layer-btn visibility ${layer.visible ? '' : 'visibility-off'}" title="${layer.visible ? 'Hide' : 'Show'}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          ${layer.visible
            ? '<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>'
            : '<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><line x1="2" y1="2" x2="14" y2="14"/>'
          }
        </svg>
      </button>
      <button class="user-layer-btn remove" title="Remove layer">&times;</button>
    `;

    div.querySelector('.visibility')!.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserLayerVisibility(layer.id);
    });

    div.querySelector('.remove')!.addEventListener('click', (e) => {
      e.stopPropagation();
      removeUserLayer(layer.id);
    });

    container.appendChild(div);
  }
}

// ─── Handle URL params (from popup search) ───────────────────────────

function handleURLParams(): void {
  const params = new URLSearchParams(window.location.search);
  const lat = params.get('lat');
  const lon = params.get('lon');
  const name = params.get('name');
  const bboxStr = params.get('bbox');

  if (lat && lon && name) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    // Try to find country in boundaries
    setTimeout(() => {
      if (!countriesGeoJSON) return;

      const countryFeature = findCountryByName(countriesGeoJSON, name);
      if (countryFeature) {
        const bbox = computeBBox(countryFeature.geometry);
        selectAOI({
          type: 'country',
          name,
          geometry: countryFeature.geometry,
          bbox,
          centroid: computeCentroid(bbox),
          properties: countryFeature.properties as Record<string, unknown>,
        });
      } else if (bboxStr) {
        // Use provided bbox
        const parts = bboxStr.split(',').map(Number);
        const bbox: BBox = { south: parts[0], north: parts[1], west: parts[2], east: parts[3] };
        selectAOI({
          type: 'custom',
          name,
          geometry: bboxToPolygon(bbox),
          bbox,
          centroid: { lng: lonNum, lat: latNum },
        });
      }
    }, 2000); // Wait for boundaries to load
  }
}

// ─── Page size / orientation handlers ────────────────────────────────

document.getElementById('page-size')!.addEventListener('change', (e) => {
  const size = (e.target as HTMLSelectElement).value;
  const orientation = (document.getElementById('page-orientation') as HTMLSelectElement).value;
  updatePageConfig(size, orientation as 'landscape' | 'portrait');
});

document.getElementById('page-orientation')!.addEventListener('change', (e) => {
  const orientation = (e.target as HTMLSelectElement).value;
  const size = (document.getElementById('page-size') as HTMLSelectElement).value;
  updatePageConfig(size, orientation as 'landscape' | 'portrait');
});

function updatePageConfig(size: string, orientation: 'landscape' | 'portrait'): void {
  const sizes: Record<string, { w: number; h: number }> = {
    A4: { w: 210, h: 297 },
    A3: { w: 297, h: 420 },
    A2: { w: 420, h: 594 },
    A1: { w: 594, h: 841 },
    Letter: { w: 215.9, h: 279.4 },
    Tabloid: { w: 279.4, h: 431.8 },
    B4: { w: 250, h: 353 },
  };
  const s = sizes[size] || sizes.A4;

  if (orientation === 'landscape') {
    pageConfig.pageWidthMM = s.h;
    pageConfig.pageHeightMM = s.w;
  } else {
    pageConfig.pageWidthMM = s.w;
    pageConfig.pageHeightMM = s.h;
  }

  // Reset overrides to new defaults for new page size
  state.elementOverrides = computeDefaultOverrides(pageConfig);

  if (state.aoi) renderLayoutPreview();
}

// ─── Basemap Switching ────────────────────────────────────────────────

function buildBasemapSource(basemap: BasemapDefinition): maplibregl.RasterSourceSpecification {
  return {
    type: 'raster',
    tiles: basemap.tiles,
    tileSize: basemap.tileSize,
    attribution: basemap.attribution,
    maxzoom: basemap.maxzoom,
  };
}

function switchBasemap(id: string): void {
  const basemap = getBasemapById(id);
  if (!basemap || id === currentBasemapId) return;

  // Remove current basemap layer + source
  if (map.getLayer('basemap-layer')) map.removeLayer('basemap-layer');
  if (map.getSource('basemap-source')) map.removeSource('basemap-source');

  // Add new basemap
  map.addSource('basemap-source', buildBasemapSource(basemap));

  // Find the first non-basemap layer to insert beneath it
  const layers = map.getStyle().layers || [];
  const firstOverlayId = layers.find((l) => l.id !== 'basemap-layer')?.id;

  map.addLayer(
    {
      id: 'basemap-layer',
      type: 'raster',
      source: 'basemap-source',
      minzoom: basemap.minzoom,
      maxzoom: basemap.maxzoom,
    },
    firstOverlayId,
  );

  currentBasemapId = id;

  // Re-render preview once tiles settle
  if (state.aoi) {
    map.once('idle', () => renderLayoutPreview());
  }
}

function initBasemapSelector(): void {
  const options: DropdownOption[] = BASEMAP_CATALOG.map((b) => ({
    value: b.id,
    label: `${b.category} > ${b.name}`,
  }));

  basemapSelector = new SearchableDropdown({
    container: document.getElementById('basemap-selector-container')!,
    placeholder: 'Search basemaps...',
    onSelect: (opt) => switchBasemap(opt.value),
  });

  basemapSelector.setOptions(options);
  basemapSelector.setValue(DEFAULT_BASEMAP_ID);
}

// ─── Admin Boundary Selectors ─────────────────────────────────────────

function initAdminSelectors(): void {
  // Country selector — populated from Natural Earth data (already loaded)
  countrySelector = new SearchableDropdown({
    container: document.getElementById('country-selector-container')!,
    label: 'Country',
    placeholder: 'Search country...',
    onSelect: handleCountrySelect,
  });

  // State/Province selector — populated on country selection
  stateSelector = new SearchableDropdown({
    container: document.getElementById('state-selector-container')!,
    label: 'State / Province',
    placeholder: 'Select a country first',
    onSelect: handleStateSelect,
  });
  stateSelector.setEnabled(false);

  // District/Locality selector — populated on state selection
  districtSelector = new SearchableDropdown({
    container: document.getElementById('district-selector-container')!,
    label: 'District / Locality',
    placeholder: 'Select a state first',
    onSelect: handleDistrictSelect,
  });
  districtSelector.setEnabled(false);

  // Populate countries from loaded Natural Earth data
  populateCountrySelector();
}

function populateCountrySelector(): void {
  if (!countriesGeoJSON) return;

  const options: DropdownOption[] = countriesGeoJSON.features
    .map((f) => ({
      value: getCountryISO3(f),
      label: (f.properties?.NAME || f.properties?.ADMIN || 'Unknown') as string,
      data: f,
    }))
    .filter((o) => o.value !== '-99') // Remove unrecognized territories
    .sort((a, b) => a.label.localeCompare(b.label));

  countrySelector.setOptions(options);
}

async function handleCountrySelect(option: DropdownOption): Promise<void> {

  const feature = option.data as GeoJSON.Feature;
  const iso3 = option.value;
  currentCountryISO3 = iso3;
  currentStateName = null;

  // Store country boundary for inset maps
  const geometry = feature.geometry;
  const bbox = computeBBox(geometry);
  const centroid = computeCentroid(bbox);
  parentCountryBBox = bbox;
  parentCountryName = option.label;
  parentCountryGeometry = geometry;
  parentStateBBox = null;
  parentStateName = null;
  parentStateGeometry = null;

  selectAOI({
    type: 'country',
    name: option.label,
    geometry,
    bbox,
    centroid,
    properties: feature.properties as Record<string, unknown>,
    parentCountryISO3: iso3,
    adminLevel: 0,
  });

  // Reset lower selectors
  stateSelector.clear();
  stateSelector.setOptions([]);
  stateSelector.setPlaceholder('Loading states...');
  stateSelector.setEnabled(false);
  districtSelector.clear();
  districtSelector.setOptions([]);
  districtSelector.setPlaceholder('Select a state first');
  districtSelector.setEnabled(false);
  cachedAdminStates = null;
  cachedAdminDistricts = null;

  // Remove existing admin layers from map
  removeAdminLayers();

  // Fetch ADM1 (states) from geoBoundaries

  stateSelector.setLoading(true);
  try {
    cachedAdminStates = await loadAdminBoundaries(iso3, 'ADM1');

    const stateOptions: DropdownOption[] = cachedAdminStates.features
      .map((f) => ({
        value: (f.properties?.NAME || 'Unknown') as string,
        label: (f.properties?.NAME || 'Unknown') as string,
        data: f,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    stateSelector.setOptions(stateOptions);
    stateSelector.setPlaceholder(`Search ${stateOptions.length} states...`);
    stateSelector.setEnabled(true);


    // Add state boundaries to map
    addAdminLayer('admin-states', cachedAdminStates, '#9333ea', [4, 3]);
  } catch (err) {
    console.warn(`No ADM1 data for ${iso3}:`, err);
    stateSelector.setPlaceholder('Not available');
    stateSelector.setError('No state data available');
  } finally {
    stateSelector.setLoading(false);
  }
}

async function handleStateSelect(option: DropdownOption): Promise<void> {
  const feature = option.data as GeoJSON.Feature;
  currentStateName = option.value;

  // Store state boundary for inset maps
  const geometry = feature.geometry;
  const bbox = computeBBox(geometry);
  const centroid = computeCentroid(bbox);
  parentStateBBox = bbox;
  parentStateName = option.label;
  parentStateGeometry = geometry;

  selectAOI({
    type: 'state',
    name: option.label,
    geometry,
    bbox,
    centroid,
    properties: feature.properties as Record<string, unknown>,
    parentCountryISO3: currentCountryISO3 ?? undefined,
    adminLevel: 1,
  });

  // Reset district selector
  districtSelector.clear();
  districtSelector.setOptions([]);
  districtSelector.setPlaceholder('Loading districts...');
  districtSelector.setEnabled(false);
  cachedAdminDistricts = null;

  // Remove district layer
  removeMapLayer('admin-districts');

  if (!currentCountryISO3) return;

  // Fetch ADM2 (districts) from geoBoundaries
  districtSelector.setLoading(true);
  try {
    cachedAdminDistricts = await loadAdminBoundaries(currentCountryISO3, 'ADM2');

    // Filter districts to those within the selected state's bounding box
    const stateBBox = bbox;
    const filteredFeatures = cachedAdminDistricts.features.filter((f) => {
      const fBBox = computeBBox(f.geometry);
      // Check if district bbox overlaps with state bbox
      return (
        fBBox.west < stateBBox.east &&
        fBBox.east > stateBBox.west &&
        fBBox.south < stateBBox.north &&
        fBBox.north > stateBBox.south
      );
    });

    const districtOptions: DropdownOption[] = filteredFeatures
      .map((f) => ({
        value: (f.properties?.NAME || 'Unknown') as string,
        label: (f.properties?.NAME || 'Unknown') as string,
        data: f,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    districtSelector.setOptions(districtOptions);
    districtSelector.setPlaceholder(`Search ${districtOptions.length} districts...`);
    districtSelector.setEnabled(true);

    // Add district boundaries to map (only filtered ones)
    const filteredCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };
    addAdminLayer('admin-districts', filteredCollection, '#ea580c', [2, 2]);
  } catch (err) {
    console.warn(`No ADM2 data for ${currentCountryISO3}:`, err);
    districtSelector.setPlaceholder('Not available');
    districtSelector.setError('No district data available');
  } finally {
    districtSelector.setLoading(false);
  }
}

function handleDistrictSelect(option: DropdownOption): void {
  const feature = option.data as GeoJSON.Feature;

  const geometry = feature.geometry;
  const bbox = computeBBox(geometry);
  const centroid = computeCentroid(bbox);

  selectAOI({
    type: 'district',
    name: option.label,
    geometry,
    bbox,
    centroid,
    properties: feature.properties as Record<string, unknown>,
    parentCountryISO3: currentCountryISO3 ?? undefined,
    parentStateName: currentStateName ?? undefined,
    adminLevel: 2,
  });
}

// ─── Admin Map Layers ─────────────────────────────────────────────────

function addAdminLayer(
  sourceId: string,
  data: GeoJSON.FeatureCollection,
  color: string,
  dasharray: number[]
): void {
  // Remove existing layer/source first
  removeMapLayer(sourceId);

  map.addSource(sourceId, {
    type: 'geojson',
    data,
  });

  map.addLayer({
    id: `${sourceId}-border`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': color,
      'line-width': 1.2,
      'line-dasharray': dasharray,
      'line-opacity': 0.7,
    },
  });
}

function removeMapLayer(sourceId: string): void {
  const layerId = `${sourceId}-border`;
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function removeAdminLayers(): void {
  removeMapLayer('admin-states');
  removeMapLayer('admin-districts');
}

/**
 * Sync a map country click to the dropdown selector.
 * Called from the existing handleCountryClick() function.
 */
function syncCountryClickToDropdown(iso3: string): void {

  if (countrySelector && iso3 !== '-99') {
    countrySelector.setValue(iso3, true);
  }
}

// ─── i18n (Language Switching) ─────────────────────────────────────────

function initI18n(): void {
  const locale = initLocale();
  const langSelect = document.getElementById('lang-select') as HTMLSelectElement;
  langSelect.value = locale;

  langSelect.addEventListener('change', () => {
    const newLocale = langSelect.value as Locale;
    setLocale(newLocale);
    applyTranslations();
  });

  applyTranslations();
}

function applyTranslations(): void {
  // Translate all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n') as keyof TranslationStrings;
    if (key) el.textContent = t(key);
  });
}

// ─── Snap-to-Grid / Alignment Guides ──────────────────────────────────

function getSnapGuides(): { vertical: number[]; horizontal: number[] } {
  const m = pageConfig.marginMM;
  const w = pageConfig.pageWidthMM;
  const h = pageConfig.pageHeightMM;
  return {
    vertical: [m, w / 2, w - m, w / 4, 3 * w / 4],
    horizontal: [m, h / 2, h - m, h / 4, 3 * h / 4],
  };
}

let activeSnapGuideH: HTMLElement | null = null;
let activeSnapGuideV: HTMLElement | null = null;

function showSnapGuides(snapX: number | null, snapY: number | null): void {
  const host = document.getElementById('layout-svg-host')!;

  if (snapX !== null) {
    if (!activeSnapGuideV) {
      activeSnapGuideV = document.createElement('div');
      activeSnapGuideV.className = 'snap-guide snap-guide-v';
      host.appendChild(activeSnapGuideV);
    }
    const pxX = (snapX / pageConfig.pageWidthMM) * host.clientWidth;
    activeSnapGuideV.style.left = `${pxX}px`;
    activeSnapGuideV.style.display = '';
  } else if (activeSnapGuideV) {
    activeSnapGuideV.style.display = 'none';
  }

  if (snapY !== null) {
    if (!activeSnapGuideH) {
      activeSnapGuideH = document.createElement('div');
      activeSnapGuideH.className = 'snap-guide snap-guide-h';
      host.appendChild(activeSnapGuideH);
    }
    const pxY = (snapY / pageConfig.pageHeightMM) * host.clientHeight;
    activeSnapGuideH.style.top = `${pxY}px`;
    activeSnapGuideH.style.display = '';
  } else if (activeSnapGuideH) {
    activeSnapGuideH.style.display = 'none';
  }
}

function hideSnapGuides(): void {
  if (activeSnapGuideH) { activeSnapGuideH.remove(); activeSnapGuideH = null; }
  if (activeSnapGuideV) { activeSnapGuideV.remove(); activeSnapGuideV = null; }
}

// ─── Dark Mode ────────────────────────────────────────────────────────

function initDarkMode(): void {
  const btn = document.getElementById('btn-dark-mode')!;
  // Restore preference
  const saved = localStorage.getItem('maplayout-dark-mode');
  if (saved === 'true') document.documentElement.classList.add('dark');

  btn.addEventListener('click', toggleDarkMode);
}

function toggleDarkMode(): void {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('maplayout-dark-mode', String(isDark));
}

// ─── Save / Load Project ─────────────────────────────────────────────

function initSaveLoad(): void {
  document.getElementById('btn-save-project')!.addEventListener('click', saveProject);
  const loadBtn = document.getElementById('btn-load-project')!;
  const fileInput = document.getElementById('project-file-input') as HTMLInputElement;
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) {
      loadProject(fileInput.files[0]);
      fileInput.value = '';
    }
  });
}

function saveProject(): void {
  readFieldsFromUI();
  const project = {
    version: '1.2.0',
    savedAt: new Date().toISOString(),
    pageConfig: { ...pageConfig },
    fields: { ...state.fields },
    elementOverrides: state.elementOverrides,
    customTexts: state.customTexts,
    drawings: state.drawings,
    logoImages: state.logoImages,
    grid: state.grid,
    boundaryColors: state.boundaryColors,
    customLegendEntries: state.customLegendEntries,
    activeLayers: state.activeLayers,
    renderedMaps: state.renderedMaps,
    mainMapBBox: state.mainMapBBox,
    scaleBar: state.scaleBar,
    insetLabels: state.insetLabels,
    mapView: state.mapView,
    aoi: state.aoi ? {
      type: state.aoi.type,
      name: state.aoi.name,
      geometry: state.aoi.geometry,
      bbox: state.aoi.bbox,
      centroid: state.aoi.centroid,
      adminLevel: state.aoi.adminLevel,
      parentCountryISO3: state.aoi.parentCountryISO3,
      parentStateName: state.aoi.parentStateName,
      properties: state.aoi.properties,
    } : null,
  };
  const json = JSON.stringify(project);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${state.fields.title || 'layout'}_${state.fields.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `${filename}.maplayout`);
  updateStatus('Project saved!');
}

function loadProject(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(reader.result as string);

      // Restore page config
      if (project.pageConfig) {
        pageConfig.pageWidthMM = project.pageConfig.pageWidthMM;
        pageConfig.pageHeightMM = project.pageConfig.pageHeightMM;
        pageConfig.marginMM = project.pageConfig.marginMM;
      }

      // Restore state
      if (project.fields) state.fields = project.fields;
      if (project.elementOverrides) state.elementOverrides = project.elementOverrides;
      if (project.customTexts) state.customTexts = project.customTexts;
      if (project.drawings) state.drawings = project.drawings;
      if (project.logoImages) state.logoImages = project.logoImages;
      if (project.grid) state.grid = project.grid;
      if (project.boundaryColors) state.boundaryColors = project.boundaryColors;
      if (project.customLegendEntries) state.customLegendEntries = project.customLegendEntries;
      if (project.activeLayers) state.activeLayers = project.activeLayers;

      // Restore rendered maps (the captured map images)
      if (project.renderedMaps) state.renderedMaps = project.renderedMaps;
      if (project.mainMapBBox) state.mainMapBBox = project.mainMapBBox;
      if (project.scaleBar) state.scaleBar = project.scaleBar;
      if (project.insetLabels) state.insetLabels = project.insetLabels;
      if (project.mapView) state.mapView = project.mapView;

      // Restore AOI (the selected area geometry + metadata)
      if (project.aoi) {
        state.aoi = {
          type: project.aoi.type,
          name: project.aoi.name,
          geometry: project.aoi.geometry,
          bbox: project.aoi.bbox,
          centroid: project.aoi.centroid,
          adminLevel: project.aoi.adminLevel,
          parentCountryISO3: project.aoi.parentCountryISO3,
          parentStateName: project.aoi.parentStateName,
          properties: project.aoi.properties,
        };

        // Show AOI on map
        (map.getSource('aoi') as GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: state.aoi.geometry, properties: {} }],
        });

        // Fly map to AOI
        map.fitBounds(
          [[state.aoi.bbox.west, state.aoi.bbox.south], [state.aoi.bbox.east, state.aoi.bbox.north]],
          { padding: 60, duration: 1000 }
        );

        // Detect CRS
        state.crs = detectUTMZone(state.aoi.centroid);
        updateAOIStatus(state.aoi);
      }

      syncUIFromState();
      renderLegendEntryList();

      // Rebuild the SVG layout with saved map images
      if (state.aoi && state.renderedMaps.main) {
        rebuildSVGOnly();
        updateStatus(`Project loaded: ${file.name}`);
      } else if (state.aoi) {
        // No saved map images — re-capture from map
        updateStatus(`Project loaded. Recapturing maps...`);
        map.once('idle', () => renderLayoutPreview());
      } else {
        updateStatus(`Project loaded: ${file.name} (no AOI selected)`);
      }

      pushHistory();
    } catch (err) {
      console.error('Failed to load project:', err);
      alert(`Failed to load project: ${(err as Error).message}`);
    }
  };
  reader.readAsText(file);
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────

function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Don't intercept when user is typing in an input/textarea
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      // But still handle Escape to close popups
      if (e.key === 'Escape') {
        hideTextEditPopup();
        hideDrawingEditPopup();
        hideLogoEditPopup();
        clearSelection();
      }
      return;
    }

    // Ctrl+Z → Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z → Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }

    // Ctrl+S → Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveProject();
      return;
    }

    // D → Toggle dark mode
    if (e.key === 'd' || e.key === 'D') {
      toggleDarkMode();
      return;
    }

    // Escape → Close popups, deselect
    if (e.key === 'Escape') {
      hideTextEditPopup();
      hideDrawingEditPopup();
      hideLogoEditPopup();
      clearSelection();
      return;
    }

    // Delete / Backspace → Delete selected element
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElementId && selectedElementType) {
        if (selectedElementType === 'custom-text') {
          removeCustomText(selectedElementId);
        } else if (selectedElementType === 'drawing') {
          removeDrawing(selectedElementId);
        } else if (selectedElementType === 'logo-image') {
          removeLogoImage(selectedElementId);
        }
        pushHistory();
      }
      return;
    }

    // L → Toggle lock on selected element
    if (e.key === 'l' || e.key === 'L') {
      toggleSelectedLock();
      return;
    }

    // Arrow keys → Nudge selected element
    const nudgeMap: Record<string, { dx: number; dy: number }> = {
      ArrowUp: { dx: 0, dy: -0.5 },
      ArrowDown: { dx: 0, dy: 0.5 },
      ArrowLeft: { dx: -0.5, dy: 0 },
      ArrowRight: { dx: 0.5, dy: 0 },
    };
    if (nudgeMap[e.key] && selectedElementId) {
      e.preventDefault();
      nudgeSelected(nudgeMap[e.key].dx, nudgeMap[e.key].dy);
      return;
    }

    // + / - → Resize selected (for scalable elements)
    if ((e.key === '+' || e.key === '=') && selectedElementId) {
      resizeSelected(1);
      return;
    }
    if (e.key === '-' && selectedElementId) {
      resizeSelected(-1);
      return;
    }
  });
}

function nudgeSelected(dx: number, dy: number): void {
  if (!selectedElementId || !selectedElementType) return;

  if (selectedElementType === 'custom-text') {
    const ct = state.customTexts?.find(t => t.id === selectedElementId);
    if (ct && !ct.locked) {
      ct.position.x += dx;
      ct.position.y += dy;
      rebuildSVGOnly();
    }
  } else if (selectedElementType === 'logo-image') {
    const img = state.logoImages?.find(i => i.id === selectedElementId);
    if (img && !img.locked) {
      img.position.x += dx;
      img.position.y += dy;
      rebuildSVGOnly();
    }
  } else if (selectedElementType === 'drawing') {
    const d = state.drawings?.find(d => d.id === selectedElementId);
    if (d && !d.locked) {
      d.x1 += dx; d.y1 += dy;
      d.x2 += dx; d.y2 += dy;
      rebuildSVGOnly();
    }
  } else if (selectedElementType === 'element') {
    const ov = state.elementOverrides;
    if (ov && selectedElementId in ov) {
      const entry = ov[selectedElementId as keyof ElementOverrides];
      if ('position' in entry) {
        entry.position.x += dx;
        entry.position.y += dy;
        rebuildSVGOnly();
      }
    }
  }
}

function resizeSelected(delta: number): void {
  if (!selectedElementId || !selectedElementType) return;

  if (selectedElementType === 'logo-image') {
    const img = state.logoImages?.find(i => i.id === selectedElementId);
    if (img) {
      img.widthMM = Math.max(5, Math.min(150, img.widthMM + delta));
      img.heightMM = img.widthMM / img.aspectRatio;
      rebuildSVGOnly();
    }
  } else if (selectedElementType === 'custom-text') {
    const ct = state.customTexts?.find(t => t.id === selectedElementId);
    if (ct) {
      ct.fontSize = Math.max(1.5, Math.min(12, ct.fontSize + delta * 0.5));
      rebuildSVGOnly();
    }
  }
}

function toggleSelectedLock(): void {
  if (!selectedElementId || !selectedElementType) return;

  if (selectedElementType === 'custom-text') {
    const ct = state.customTexts?.find(t => t.id === selectedElementId);
    if (ct) { ct.locked = !ct.locked; rebuildSVGOnly(); }
  } else if (selectedElementType === 'drawing') {
    const d = state.drawings?.find(d => d.id === selectedElementId);
    if (d) { d.locked = !d.locked; rebuildSVGOnly(); }
  } else if (selectedElementType === 'logo-image') {
    const img = state.logoImages?.find(i => i.id === selectedElementId);
    if (img) { img.locked = !img.locked; rebuildSVGOnly(); }
  }
  pushHistory();
}

// ─── Page Size Presets ───────────────────────────────────────────────

function initPagePresets(): void {
  const presetsContainer = document.getElementById('page-presets')!;
  presetsContainer.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('.preset-btn') as HTMLElement;
    if (!btn) return;

    const preset = btn.dataset.preset!;
    const [size, orientation] = preset.split('-') as [string, 'landscape' | 'portrait'];

    // Update dropdowns
    (document.getElementById('page-size') as HTMLSelectElement).value = size;
    (document.getElementById('page-orientation') as HTMLSelectElement).value = orientation;

    // Update active state
    presetsContainer.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updatePageConfig(size, orientation);
  });
}

// ─── Boundary Colors ─────────────────────────────────────────────────

function initBoundaryColors(): void {
  const ids = ['bc-aoi-fill', 'bc-aoi-fill-opacity', 'bc-aoi-stroke', 'bc-aoi-stroke-width', 'bc-country-stroke', 'bc-country-stroke-width'];
  for (const id of ids) {
    document.getElementById(id)!.addEventListener('input', applyBoundaryColors);
  }
}

function applyBoundaryColors(): void {
  const bc: BoundaryColorSettings = {
    aoiFill: (document.getElementById('bc-aoi-fill') as HTMLInputElement).value,
    aoiFillOpacity: parseFloat((document.getElementById('bc-aoi-fill-opacity') as HTMLInputElement).value),
    aoiStroke: (document.getElementById('bc-aoi-stroke') as HTMLInputElement).value,
    aoiStrokeWidth: parseFloat((document.getElementById('bc-aoi-stroke-width') as HTMLInputElement).value),
    countryStroke: (document.getElementById('bc-country-stroke') as HTMLInputElement).value,
    countryStrokeWidth: parseFloat((document.getElementById('bc-country-stroke-width') as HTMLInputElement).value),
  };
  state.boundaryColors = bc;

  // Apply to map live
  if (map.getLayer('aoi-fill')) {
    map.setPaintProperty('aoi-fill', 'fill-color', bc.aoiFill);
    map.setPaintProperty('aoi-fill', 'fill-opacity', bc.aoiFillOpacity);
  }
  if (map.getLayer('aoi-border')) {
    map.setPaintProperty('aoi-border', 'line-color', bc.aoiStroke);
    map.setPaintProperty('aoi-border', 'line-width', bc.aoiStrokeWidth);
  }
  if (map.getLayer('countries-border')) {
    map.setPaintProperty('countries-border', 'line-color', bc.countryStroke);
    map.setPaintProperty('countries-border', 'line-width', bc.countryStrokeWidth);
  }
}

// ─── Coordinate Display ──────────────────────────────────────────────

function initCoordDisplay(): void {
  const coordText = document.getElementById('coord-text')!;
  map.on('mousemove', (e) => {
    const { lng, lat } = e.lngLat;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    coordText.textContent = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  });
  map.on('mouseleave', () => {
    coordText.textContent = '--';
  });
}

// ─── Shortcuts Modal ─────────────────────────────────────────────────

function initShortcutsModal(): void {
  const modal = document.getElementById('shortcuts-modal')!;
  document.getElementById('btn-shortcuts')!.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('shortcuts-close')!.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

// ─── Push history after mutations ─────────────────────────────────────

/** Wrap rebuildSVGOnly to also push history on meaningful changes */
const originalRebuildSVGOnly = rebuildSVGOnly;

/** Debounced history push — called after user interactions settle */
let historyPushTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedHistoryPush(): void {
  if (historyPushTimeout) clearTimeout(historyPushTimeout);
  historyPushTimeout = setTimeout(() => pushHistory(), 800);
}

// ─── Initialize ──────────────────────────────────────────────────────

initMap()
  .then(() => {
    initAdminSelectors();
    initBasemapSelector();
    initElementControls();
    initWheelResize();
    initPreviewWheelZoom();
    initLegendEditor();
    initDataImport();
    initDrawingTools();
    initLogoImport();
    initDarkMode();
    initSaveLoad();
    initKeyboardShortcuts();
    initPagePresets();
    initBoundaryColors();
    initCoordDisplay();
    initShortcutsModal();
    initI18n();
    handleURLParams();

    // Initial history snapshot
    pushHistory();

    console.log('[MapLayout Pro] Designer initialized');
  })
  .catch((err) => {
    console.error('[MapLayout Pro] Init failed:', err);
    updateStatus(`Error: ${(err as Error).message}`);
  });
