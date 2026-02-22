/** Runtime layout state types (distinct from template schema) */

import type { AOISelection, CRSInfo, ScaleBarInfo, LayoutManifest } from './geo';
import type { LayoutTemplate } from './template';
import type { UserDataLayer } from './userdata';

export interface ElementPosition { x: number; y: number; }

export interface NorthArrowOverrides {
  visible: boolean; position: ElementPosition; scale: number;
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
  /** Geographic bbox of the main map frame at capture time */
  mainMapBBox?: import('./geo').BBox;
  /** Coordinate grid settings */
  grid?: GridSettings;
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
  Letter: { width: 215.9, height: 279.4 },
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
