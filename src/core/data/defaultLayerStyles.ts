/** Default color palette for user-imported data layers */

const LAYER_COLORS = [
  '#e63946', // red
  '#2a9d8f', // teal
  '#e9c46a', // gold
  '#264653', // dark blue
  '#f4a261', // orange
  '#6a4c93', // purple
  '#1d3557', // navy
  '#457b9d', // steel blue
];

export function getLayerColor(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}
