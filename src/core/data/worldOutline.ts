/**
 * Simplified world coastline as SVG path data for the overview locator map.
 * Pre-projected in Equirectangular (Plate Carree): lng → x, lat → y.
 * Simplified to major landmasses for small-scale rendering.
 */

// Simplified continent outlines as SVG path strings
// Each path is in lng/lat coordinates: x = longitude (-180..180), y = latitude (-90..90)
// To render: transform to pixel coords in the locator map box
export const WORLD_PATHS: { name: string; path: [number, number][] }[] = [
  // Africa (simplified)
  { name: 'Africa', path: [
    [-17, 14], [-12, 15], [-5, 15], [5, 15], [10, 14], [12, 12], [10, 5], [10, 0],
    [12, -5], [15, -10], [20, -15], [27, -20], [35, -28], [33, -34], [28, -33],
    [20, -30], [17, -28], [12, -18], [10, -10], [5, -5], [1, 0], [-5, 5],
    [-10, 5], [-15, 10], [-17, 14],
  ]},
  // Europe (simplified)
  { name: 'Europe', path: [
    [-10, 36], [-5, 36], [0, 38], [3, 43], [-2, 44], [-10, 44], [-10, 52],
    [-5, 55], [0, 51], [5, 52], [10, 55], [12, 54], [15, 55], [20, 55],
    [25, 55], [30, 55], [35, 50], [40, 45], [30, 40], [25, 37], [20, 38],
    [15, 38], [10, 44], [5, 44], [3, 43], [-5, 36], [-10, 36],
  ]},
  // Asia (simplified)
  { name: 'Asia', path: [
    [25, 37], [30, 40], [35, 50], [40, 55], [50, 55], [60, 55], [70, 55],
    [80, 50], [90, 50], [100, 50], [110, 45], [120, 40], [125, 35], [130, 35],
    [135, 35], [140, 40], [142, 45], [140, 50], [135, 55], [130, 60], [140, 65],
    [170, 65], [180, 65], [180, 55], [170, 55], [160, 50], [150, 45], [140, 40],
    [145, 35], [140, 30], [130, 30], [120, 25], [110, 20], [105, 15], [100, 10],
    [95, 5], [100, 0], [105, -5], [105, -8], [95, -5], [90, 10], [80, 15],
    [75, 15], [70, 20], [65, 25], [60, 25], [55, 25], [50, 30], [45, 32],
    [40, 30], [35, 30], [30, 35], [25, 37],
  ]},
  // North America (simplified)
  { name: 'North America', path: [
    [-170, 65], [-160, 60], [-150, 60], [-140, 60], [-130, 55],
    [-125, 48], [-120, 35], [-115, 30], [-105, 25], [-100, 20],
    [-95, 18], [-90, 18], [-85, 15], [-80, 10], [-78, 8],
    [-82, 10], [-85, 12], [-87, 15], [-90, 20], [-95, 25],
    [-97, 28], [-95, 30], [-90, 30], [-85, 30], [-80, 32],
    [-75, 35], [-70, 42], [-65, 45], [-60, 47], [-55, 50],
    [-60, 55], [-65, 60], [-70, 60], [-75, 60], [-80, 65],
    [-90, 65], [-100, 70], [-120, 72], [-140, 70], [-160, 65],
    [-170, 65],
  ]},
  // South America (simplified)
  { name: 'South America', path: [
    [-80, 10], [-78, 8], [-75, 5], [-70, 5], [-60, 5], [-50, 0],
    [-45, -5], [-38, -10], [-35, -15], [-40, -20], [-43, -23],
    [-48, -28], [-55, -34], [-58, -38], [-65, -42], [-68, -47],
    [-75, -52], [-72, -48], [-73, -42], [-72, -35], [-70, -25],
    [-75, -15], [-78, -5], [-80, 0], [-80, 5], [-80, 10],
  ]},
  // Australia (simplified)
  { name: 'Australia', path: [
    [115, -15], [120, -14], [130, -12], [135, -12], [140, -15],
    [145, -17], [150, -23], [153, -28], [150, -35], [145, -38],
    [138, -36], [135, -35], [130, -33], [125, -34], [118, -35],
    [115, -33], [113, -28], [113, -22], [115, -15],
  ]},
];

/**
 * Project world paths to SVG coordinates within a given box.
 * Returns SVG path data string.
 */
export function projectWorldToSVG(
  boxX: number, boxY: number, boxSize: number
): string {
  let svgPaths = '';
  for (const continent of WORLD_PATHS) {
    const points = continent.path.map(([lng, lat]) => {
      const x = boxX + ((lng + 180) / 360) * boxSize;
      const y = boxY + ((90 - lat) / 180) * (boxSize * 0.5);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    svgPaths += `M${points.join('L')}Z `;
  }
  return svgPaths.trim();
}
