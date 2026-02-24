/** Runtime layout state types (distinct from template schema) */

import type { AOISelection, CRSInfo, ScaleBarInfo, LayoutManifest } from './geo';
import type { LayoutTemplate } from './template';
import type { UserDataLayer } from './userdata';

export interface ElementPosition { x: number; y: number; }

export type NorthArrowStyle = 'simple' | 'compass-rose' | 'ornate' | 'minimal' | 'nato' | 'modern' | 'vintage';

export type MapFrameBorderStyle = 'simple' | 'double' | 'shadow' | 'neatline-ticks' | 'rounded' | 'none';

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  angle: number;
}

export interface CalloutAnnotation {
  id: string;
  text: string;
  targetLngLat: { lng: number; lat: number };
  targetSVG?: { x: number; y: number };
  position: ElementPosition;
  fontSize: number;
  color: string;
  backgroundColor: string;
  locked?: boolean;
}

export interface ChoroplethConfig {
  enabled: boolean;
  csvData?: string;
  joinColumn: string;
  valueColumn: string;
  classificationMethod: 'equal-interval' | 'quantile';
  numClasses: number;
  colorStart: string;
  colorEnd: string;
  breaks?: number[];
  legendEntries?: { label: string; color: string }[];
  paletteId?: string;
}

// ─── New Feature Types ───────────────────────────────────────────────

export interface ScaleTextSettings {
  visible: boolean;
  position: ElementPosition;
  fontSize: number;
}

export interface DisclaimerBoxSettings {
  visible: boolean;
  position: ElementPosition;
  text: string;
  fontSize: number;
  width: number;
  backgroundColor: string;
  borderColor: string;
}

export interface QRCodeSettings {
  visible: boolean;
  position: ElementPosition;
  size: number;
  url: string;
}

export interface LocatorMapSettings {
  visible: boolean;
  position: ElementPosition;
  size: number;
}

export interface AutoLabelSettings {
  enabled: boolean;
  fontSize: number;
  color: string;
  haloColor: string;
  haloWidth: number;
}

export interface SymbolAnnotation {
  id: string;
  symbolId: string;
  targetLngLat: { lng: number; lat: number };
  targetSVG?: { x: number; y: number };
  size: number;
  color: string;
  label?: string;
  locked?: boolean;
}

export type HatchPattern = 'none' | 'diagonal' | 'crosshatch' | 'horizontal' | 'vertical' | 'dots' | 'circles';

export interface AtlasConfig {
  enabled: boolean;
  cols: number;
  rows: number;
  overlap: number;
  currentPage: number;
  totalPages: number;
  pageExtents: import('./geo').BBox[];
}

export interface DataTableSettings {
  visible: boolean;
  position: ElementPosition;
  headers: string[];
  rows: string[][];
  fontSize: number;
  width: number;
  headerBg: string;
  headerColor: string;
  cellBg: string;
  borderColor: string;
  maxRows: number;
}

export interface CustomFont {
  name: string;
  dataUrl: string;
  format: string;
}

export interface NorthArrowOverrides {
  visible: boolean; position: ElementPosition; scale: number;
  style?: NorthArrowStyle;
}
export interface TitleBlockOverrides {
  position: ElementPosition; fontSize: number;
}
export interface ScaleBarOverrides {
  visible: boolean; position: ElementPosition;
}
export interface LegendOverrides {
  visible: boolean; position: ElementPosition; scale: number;
}

export interface LegendEntry {
  id: string;
  label: string;
  color: string;
  type: 'fill' | 'line' | 'circle';
  visible: boolean;
  pattern?: HatchPattern;
}
export interface ElementOverrides {
  northArrow: NorthArrowOverrides;
  titleBlock: TitleBlockOverrides;
  scaleBar: ScaleBarOverrides;
  legend: LegendOverrides;
}

export interface CustomTextAnnotation {
  id: string; text: string; position: ElementPosition;
  fontSize: number; color: string; fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  fontFamily: string;
  locked?: boolean;
}

export type DrawingShapeType = 'line' | 'arrow' | 'circle' | 'point' | 'rectangle';

export interface DrawingAnnotation {
  id: string;
  type: DrawingShapeType;
  /** Start point in SVG mm coords */
  x1: number; y1: number;
  /** End point / second corner (unused for 'point') */
  x2: number; y2: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  locked?: boolean;
}

export interface ImageAnnotation {
  id: string;
  name: string;           // original filename
  dataUrl: string;        // base64 data URL (PNG/JPG/WebP)
  position: ElementPosition;
  widthMM: number;        // display width in mm
  heightMM: number;       // display height in mm
  opacity: number;        // 0–1
  aspectRatio: number;    // original width/height for proportional resize
  locked?: boolean;
}


export interface LayoutState {
  /** The base template */
  template: LayoutTemplate;
  /** User-selected area of interest */
  aoi: AOISelection | null;
  /** Auto-detected CRS info for the AOI */
  crs: CRSInfo | null;
  /** Computed scale bar parameters */
  scaleBar: ScaleBarInfo | null;
  /** User-editable fields */
  fields: LayoutFields;
  /** Active layer IDs */
  activeLayers: string[];
  /** Map view state */
  mapView: MapViewState;
  /** Rendered map images (data URLs) */
  renderedMaps: RenderedMaps;
  /** Labels for inset map frames */
  insetLabels?: InsetLabels;
  /** Element positioning/visibility overrides */
  elementOverrides?: ElementOverrides;
  /** Custom text annotations */
  customTexts?: CustomTextAnnotation[];
  /** User-imported data layers */
  userLayers?: UserDataLayer[];
  /** Custom legend entries (overrides auto-generated legend when non-empty) */
  customLegendEntries?: LegendEntry[];
  /** Drawing shape annotations */
  drawings?: DrawingAnnotation[];
  /** Logo / image annotations */
  logoImages?: ImageAnnotation[];
  /** Geographic bbox of the main map frame at capture time */
  mainMapBBox?: import('./geo').BBox;
  /** Coordinate grid settings */
  grid?: GridSettings;
  /** Boundary color overrides */
  boundaryColors?: BoundaryColorSettings;
  /** Print crop & bleed marks */
  cropMarks?: boolean;
  /** Watermark / draft stamp */
  watermark?: WatermarkSettings;
  /** Map frame border style */
  frameBorderStyle?: MapFrameBorderStyle;
  /** Ruler guides (user-dragged) */
  guides?: { h: number[]; v: number[] };
  /** Hillshade terrain toggle */
  hillshadeEnabled?: boolean;
  /** Map callout / label annotations */
  callouts?: CalloutAnnotation[];
  /** Choropleth / thematic mapping configuration */
  choropleth?: ChoroplethConfig;
  /** Scale text block (e.g., "Scale 1:50,000 at A3") */
  scaleText?: ScaleTextSettings;
  /** Disclaimer / data sources box */
  disclaimerBox?: DisclaimerBoxSettings;
  /** QR code linking to map location */
  qrCode?: QRCodeSettings;
  /** Overview locator map showing AOI on world outline */
  locatorMap?: LocatorMapSettings;
  /** Auto label placement settings */
  autoLabels?: AutoLabelSettings;
  /** Symbol / marker annotations */
  symbols?: SymbolAnnotation[];
  /** Map label language override */
  mapLabelLang?: string;
  /** Atlas / map series configuration */
  atlas?: AtlasConfig;
  /** Data table insert */
  dataTable?: DataTableSettings;
  /** Custom imported fonts */
  customFonts?: CustomFont[];
}

export interface BoundaryColorSettings {
  aoiFill: string;
  aoiFillOpacity: number;
  aoiStroke: string;
  aoiStrokeWidth: number;
  countryStroke: string;
  countryStrokeWidth: number;
}

export interface GridSettings {
  visible: boolean;
  /** Grid line color */
  color: string;
  /** Grid line opacity (0-1) */
  opacity: number;
  /** Grid line width in mm */
  lineWidth: number;
  /** Label font size in mm */
  labelSize: number;
  /** Label color */
  labelColor: string;
  /** Where to place labels relative to the map frame */
  labelPlacement: 'inside' | 'outside';
}

export interface LayoutFields {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  organization: string;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface RenderedMaps {
  main: string | null;
  insetCountry: string | null;
  insetState: string | null;
}

export interface InsetLabels {
  country: string;
  state: string;
}

export interface ExportOptions {
  format: 'pdf' | 'png' | 'svg';
  dpi: 150 | 300 | 600;
  pageSize: 'A4' | 'A3' | 'Letter';
  orientation: 'landscape' | 'portrait';
  embedManifest: boolean;
  includeCitation: boolean;
}

export interface LayerConfig {
  id: string;
  name: string;
  type: 'fill' | 'line' | 'circle' | 'symbol';
  visible: boolean;
  color: string;
  opacity: number;
  legendLabel: string;
}

/** Page dimensions in mm for standard sizes */
export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  Letter: { width: 215.9, height: 279.4 },
  Tabloid: { width: 279.4, height: 431.8 },
  B4: { width: 250, height: 353 },
};

/** Get page dimensions accounting for orientation */
export function getPageDimensions(
  size: string,
  orientation: 'landscape' | 'portrait'
): { widthMM: number; heightMM: number } {
  const dims = PAGE_SIZES[size] || PAGE_SIZES.A4;
  if (orientation === 'landscape') {
    return { widthMM: dims.height, heightMM: dims.width };
  }
  return { widthMM: dims.width, heightMM: dims.height };
}
