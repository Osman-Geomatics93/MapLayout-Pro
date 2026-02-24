/**
 * Layout template presets — predefined style combinations.
 */

import type { NorthArrowStyle, MapFrameBorderStyle } from '../types/layout';

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Primary font family for title/body */
  fontFamily: string;
  /** Title font size (mm) */
  titleFontSize: number;
  /** Title color */
  titleColor: string;
  /** Subtitle color */
  subtitleColor: string;
  /** North arrow style */
  northArrowStyle: NorthArrowStyle;
  /** Map frame border style */
  frameBorderStyle: MapFrameBorderStyle;
  /** Accent color (used for AOI, highlights) */
  accentColor: string;
  /** Secondary color */
  secondaryColor: string;
  /** Neatline color */
  neatlineColor: string;
  /** Preview gradient (CSS) for card display */
  previewGradient: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'academic',
    name: 'Academic',
    description: 'Clean, scholarly style with serif fonts and muted colors',
    fontFamily: 'Georgia, serif',
    titleFontSize: 6,
    titleColor: '#1a1a1a',
    subtitleColor: '#444444',
    northArrowStyle: 'ornate',
    frameBorderStyle: 'double',
    accentColor: '#1e40af',
    secondaryColor: '#6b7280',
    neatlineColor: '#000000',
    previewGradient: 'linear-gradient(135deg, #f8f7f4, #e8e6e1)',
  },
  {
    id: 'humanitarian',
    name: 'Humanitarian',
    description: 'OCHA-inspired blue/gray palette for fieldwork maps',
    fontFamily: "'Noto Sans', Arial, sans-serif",
    titleFontSize: 5.5,
    titleColor: '#1a3a5c',
    subtitleColor: '#4a6a8a',
    northArrowStyle: 'minimal',
    frameBorderStyle: 'simple',
    accentColor: '#0072bc',
    secondaryColor: '#8c8c8c',
    neatlineColor: '#333333',
    previewGradient: 'linear-gradient(135deg, #e8f0fe, #ccdff5)',
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Bold, high-contrast style for slides and posters',
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    titleFontSize: 7,
    titleColor: '#111827',
    subtitleColor: '#374151',
    northArrowStyle: 'modern',
    frameBorderStyle: 'shadow',
    accentColor: '#2563eb',
    secondaryColor: '#6366f1',
    neatlineColor: '#111827',
    previewGradient: 'linear-gradient(135deg, #dbeafe, #c7d2fe)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, borderless design with minimal visual clutter',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    titleFontSize: 5,
    titleColor: '#333333',
    subtitleColor: '#666666',
    northArrowStyle: 'minimal',
    frameBorderStyle: 'none',
    accentColor: '#555555',
    secondaryColor: '#999999',
    neatlineColor: '#cccccc',
    previewGradient: 'linear-gradient(135deg, #fafafa, #f0f0f0)',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Warm, sepia-toned cartographic style with decorative elements',
    fontFamily: "'Times New Roman', Georgia, serif",
    titleFontSize: 6.5,
    titleColor: '#3d2b1f',
    subtitleColor: '#5c4a3a',
    northArrowStyle: 'vintage',
    frameBorderStyle: 'rounded',
    accentColor: '#8b4513',
    secondaryColor: '#a0784c',
    neatlineColor: '#4a3728',
    previewGradient: 'linear-gradient(135deg, #f5e6d3, #e8d5b7)',
  },
];

export function getPresetById(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find(p => p.id === id);
}
