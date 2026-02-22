/** Layout template schema types */

export interface LayoutTemplate {
  templateId: string;
  name: string;
  description: string;
  version: string;
  page: PageConfig;
  frames: MapFrame[];
  elements: LayoutElement[];
  variables: Record<string, string>;
}

export interface PageConfig {
  size: 'A4' | 'A3' | 'Letter' | 'custom';
  orientation: 'landscape' | 'portrait';
  widthMM: number;
  heightMM: number;
  marginMM: { top: number; right: number; bottom: number; left: number };
  backgroundColor: string;
}

export interface MapFrame {
  id: string;
  type: 'map';
  role: 'primary' | 'inset';
  position: FramePosition;
  map: MapFrameConfig;
  border: BorderStyle;
  label?: { text: string; fontSize: number; position: 'top' | 'bottom' };
  connector?: ConnectorConfig;
}

export interface MapFrameConfig {
  showGraticule: boolean;
  graticuleIntervalDeg: number | 'auto';
  graticuleStyle?: GraticuleStyle;
  showExtentBox?: boolean;
  extentBoxStyle?: { stroke: string; strokeWidth: number; fill: string };
}

export interface GraticuleStyle {
  stroke: string;
  strokeWidth: number;
  labelFontSize: number;
  labelColor: string;
}

export interface ConnectorConfig {
  targetFrameId: string;
  style: { stroke: string; strokeWidth: number; dashArray: string };
}

export interface FramePosition {
  xMM: number;
  yMM: number;
  widthMM: number;
  heightMM: number | 'auto';
}

export interface BorderStyle {
  stroke: string;
  strokeWidth: number;
}

export type LayoutElement =
  | TextBlockElement
  | NorthArrowElement
  | ScaleBarElement
  | LegendElement
  | CRSMetadataElement
  | NeatlineElement;

export interface BaseElement {
  id: string;
  type: string;
}

export interface TextBlockElement extends BaseElement {
  type: 'text-block';
  position: { xMM: number; yMM: number; anchorX?: 'left' | 'center' | 'right' };
  content: {
    title?: TextStyle;
    subtitle?: TextStyle & { offsetYMM?: number };
    text?: TextStyle;
  };
}

export interface TextStyle {
  text: string;
  fontSize: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
}

export interface NorthArrowElement extends BaseElement {
  type: 'north-arrow';
  position: FramePosition;
  style: 'classic' | 'minimal' | 'compass-rose' | 'modern';
  rotation: number | 'auto';
}

export interface ScaleBarElement extends BaseElement {
  type: 'scale-bar';
  position: { xMM: number; yMM: number };
  style: 'simple' | 'alternating' | 'tick';
  units: 'metric' | 'imperial' | 'both';
  maxWidthMM: number;
  showRF: boolean;
  fontSize: number;
  divisions: number;
}

export interface LegendElement extends BaseElement {
  type: 'legend';
  position: FramePosition;
  title: string;
  autoGenerate: boolean;
  fontSize: number;
  swatchSize: number;
  background: { fill: string; stroke: string; strokeWidth: number; padding: number };
}

export interface CRSMetadataElement extends BaseElement {
  type: 'crs-metadata';
  position: { xMM: number; yMM: number };
  fontSize: number;
  fontFamily: string;
  fields: string[];
}

export interface NeatlineElement extends BaseElement {
  type: 'neatline';
  margin: { top: number; right: number; bottom: number; left: number };
  style: { stroke: string; strokeWidth: number; fill: string };
}
