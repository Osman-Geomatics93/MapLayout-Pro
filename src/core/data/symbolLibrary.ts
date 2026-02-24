/**
 * Symbol / Marker Library — 30+ SVG icon definitions for map annotations.
 * Each symbol provides an SVG path string for rendering at arbitrary size.
 */

export interface SymbolDef {
  id: string;
  name: string;
  category: 'humanitarian' | 'transport' | 'infrastructure' | 'general';
  svgPath: string;
  viewBox: string;
}

export const SYMBOL_CATALOG: SymbolDef[] = [
  // ── Humanitarian ──
  { id: 'hospital', name: 'Hospital', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-3 12h-3v3h-2v-3H8v-2h3V10h2v3h3v2z' },
  { id: 'clinic', name: 'Clinic', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 2L4 7v10a2 2 0 002 2h12a2 2 0 002-2V7l-8-5zm1 14h-2v-3H8v-2h3V8h2v3h3v2h-3v3z' },
  { id: 'school', name: 'School', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm0 14.5L5.5 14 12 10.5 18.5 14 12 17.5z' },
  { id: 'camp', name: 'Camp', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 2L2 20h20L12 2zm0 4l7 12H5l7-12z' },
  { id: 'shelter', name: 'Shelter', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 3L2 12h3v8h14v-8h3L12 3zm0 3.5L18 12v6H6v-6l6-5.5z' },
  { id: 'food-dist', name: 'Food Distribution', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 2a4 4 0 00-4 4c0 1.5.8 2.8 2 3.5V22h4V9.5c1.2-.7 2-2 2-3.5a4 4 0 00-4-4zm-7 8v12h2V14h2v8h2V10H5zm12 0v12h2V14h2v8h2V10h-6z' },
  { id: 'water-point', name: 'Water Point', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 2c-4 5-7 8-7 12a7 7 0 0014 0c0-4-3-7-7-12zm0 17a5 5 0 01-5-5c0-3 2.5-6.2 5-9.4 2.5 3.2 5 6.4 5 9.4a5 5 0 01-5 5z' },
  { id: 'latrine', name: 'Latrine', category: 'humanitarian', viewBox: '0 0 24 24',
    svgPath: 'M12 2a3 3 0 100 6 3 3 0 000-6zM9 9l-2 13h2l1.5-7h3L15 22h2L15 9H9z' },

  // ── Transport ──
  { id: 'airport', name: 'Airport', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' },
  { id: 'helipad', name: 'Helipad', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zM9 8v8h2v-3h2v3h2V8h-2v3h-2V8H9z' },
  { id: 'port', name: 'Port', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M20 21c-1.5 0-2.7-.4-3.6-1.1-.8.7-2 1.1-3.4 1.1-1.4 0-2.6-.4-3.4-1.1-.9.7-2.1 1.1-3.6 1.1H4v-2h2c1 0 1.8-.3 2.5-.8C9.2 18.7 10.3 19 12 19s2.8-.3 3.5-.8c.7.5 1.5.8 2.5.8h2v2h-2zM12 3l-7 7h3v5h8v-5h3l-7-7z' },
  { id: 'bridge', name: 'Bridge', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M7 14v-4h2v4H7zm6 0v-4h2v4h-2zM3 18h18v2H3v-2zM4 8v2h1c1.1 0 2.6 1 4 2.5 1.4-1.5 2.9-2.5 4-2.5s2.6 1 4 2.5c1.4-1.5 2.9-2.5 4-2.5h1V8H4z' },
  { id: 'road-block', name: 'Road Block', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M2 18h20v2H2v-2zm1-7l9-9 9 9H3zm2.5-1h13L12 3.5 5.5 10z' },
  { id: 'fuel-station', name: 'Fuel Station', category: 'transport', viewBox: '0 0 24 24',
    svgPath: 'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 002.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16h10v-7.5h1.5v5a2.5 2.5 0 005 0V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z' },

  // ── Infrastructure ──
  { id: 'power-tower', name: 'Power Tower', category: 'infrastructure', viewBox: '0 0 24 24',
    svgPath: 'M12 2L8 8h3v5H8l-2 9h3l1-5 2 5h3l-2-9h-3V8h3L12 2z' },
  { id: 'telecom', name: 'Telecom Tower', category: 'infrastructure', viewBox: '0 0 24 24',
    svgPath: 'M12 5a2 2 0 100-4 2 2 0 000 4zm-4 1l-2 16h3l1-8 2 8h3l-2-16H8zM5 4C3.3 5.7 2.3 8 2 10.5l1.5.5C3.8 8.7 4.6 6.8 6 5.4L5 4zm14 0l-1 1.4c1.4 1.4 2.2 3.3 2.5 5.6l1.5-.5C21.7 8 20.7 5.7 19 4z' },
  { id: 'government', name: 'Government', category: 'infrastructure', viewBox: '0 0 24 24',
    svgPath: 'M12 2L2 8v2h20V8L12 2zm-7 12v-2h2v2H5zm4 0v-2h2v2H9zm4 0v-2h2v2h-2zm4 0v-2h2v2h-2zM2 18v2h20v-2H2z' },
  { id: 'police', name: 'Police', category: 'infrastructure', viewBox: '0 0 24 24',
    svgPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' },
  { id: 'fire-station', name: 'Fire Station', category: 'infrastructure', viewBox: '0 0 24 24',
    svgPath: 'M12 2C9 6 6 9 6 14a6 6 0 0012 0c0-5-3-8-6-12zm0 17a4 4 0 01-4-4c0-2.5 1.5-5 4-8 2.5 3 4 5.5 4 8a4 4 0 01-4 4z' },

  // ── General ──
  { id: 'warning', name: 'Warning', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' },
  { id: 'info', name: 'Info', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' },
  { id: 'flag', name: 'Flag', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z' },
  { id: 'star', name: 'Star', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'diamond', name: 'Diamond', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2L2 12l10 10 10-10L12 2z' },
  { id: 'triangle', name: 'Triangle', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2L2 22h20L12 2z' },
  { id: 'cross', name: 'Cross', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M9 2v7H2v6h7v7h6v-7h7V9h-7V2H9z' },
  { id: 'circle-marker', name: 'Circle', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z' },
  { id: 'pin', name: 'Pin', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z' },
  { id: 'square', name: 'Square', category: 'general', viewBox: '0 0 24 24',
    svgPath: 'M3 3h18v18H3V3zm2 2v14h14V5H5z' },
];

/** Get all symbols in a category */
export function getSymbolsByCategory(category: SymbolDef['category']): SymbolDef[] {
  return SYMBOL_CATALOG.filter(s => s.category === category);
}

/** Get a single symbol by ID */
export function getSymbolById(id: string): SymbolDef | undefined {
  return SYMBOL_CATALOG.find(s => s.id === id);
}
