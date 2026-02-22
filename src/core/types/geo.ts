/** GIS / geospatial type definitions */

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface LngLat {
  lng: number;
  lat: number;
}

export interface CRSInfo {
  name: string;
  epsg: number;
  projection: string;
  datum: string;
  units: string;
  centralMeridian: number;
  falseEasting: number;
  falseNorthing: number;
  scaleFactor: number;
  hemisphere: 'N' | 'S';
  zoneNumber: number;
}

export interface ScaleBarInfo {
  /** Ground distance represented by the scale bar, in meters */
  distanceMeters: number;
  /** Width of the scale bar on the page, in mm */
  widthMM: number;
  /** Representative fraction denominator (e.g., 500000 for 1:500,000) */
  representativeFraction: number;
  /** Display label (e.g., "50 km") */
  label: string;
}

export interface GraticuleLines {
  parallels: GraticuleLine[];
  meridians: GraticuleLine[];
}

export interface GraticuleLine {
  type: 'parallel' | 'meridian';
  value: number;
  coords: [number, number][];
  label: string;
}

export interface AOISelection {
  type: 'country' | 'state' | 'district' | 'custom';
  name: string;
  geometry: GeoJSON.Geometry;
  bbox: BBox;
  centroid: LngLat;
  properties?: Record<string, unknown>;
  /** ISO3 code of the parent country (for state/district selections) */
  parentCountryISO3?: string;
  /** Name of the parent state (for district selections) */
  parentStateName?: string;
  /** Admin level: 0=country, 1=state, 2=district */
  adminLevel?: 0 | 1 | 2;
}

/** Layout state that captures everything needed to reproduce a map */
export interface LayoutManifest {
  manifestVersion: string;
  generatedBy: string;
  generatedAt: string;
  aoi: AOISelection;
  templateId: string;
  templateOverrides: Record<string, unknown>;
  mapState: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
    style: string;
  };
  activeLayers: string[];
  exportSettings: {
    format: 'pdf' | 'png' | 'svg';
    dpi: number;
    pageSize: string;
    orientation: string;
  };
  dataCitations: DataCitation[];
}

export interface DataCitation {
  dataset: string;
  version?: string;
  license: string;
  url: string;
  accessDate: string;
}
