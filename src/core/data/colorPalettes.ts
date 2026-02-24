/**
 * ColorBrewer palettes — colorblind-safe presets for choropleth mapping.
 * Each palette provides color arrays indexed by number of classes (3–9).
 */

export interface ColorPalette {
  id: string;
  name: string;
  type: 'sequential' | 'diverging' | 'qualitative';
  colors: Record<number, string[]>; // numClasses → color array
}

export const COLOR_PALETTES: ColorPalette[] = [
  // Sequential
  {
    id: 'YlOrRd', name: 'Yellow-Orange-Red', type: 'sequential',
    colors: {
      3: ['#ffeda0','#feb24c','#f03b20'],
      4: ['#ffffb2','#fecc5c','#fd8d3c','#e31a1c'],
      5: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'],
      6: ['#ffffb2','#fed976','#feb24c','#fd8d3c','#f03b20','#bd0026'],
      7: ['#ffffb2','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'],
      8: ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'],
      9: ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026'],
    },
  },
  {
    id: 'Blues', name: 'Blues', type: 'sequential',
    colors: {
      3: ['#deebf7','#9ecae1','#3182bd'],
      4: ['#eff3ff','#bdd7e7','#6baed6','#2171b5'],
      5: ['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c'],
      6: ['#eff3ff','#c6dbef','#9ecae1','#6baed6','#3182bd','#08519c'],
      7: ['#eff3ff','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
      8: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
      9: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b'],
    },
  },
  {
    id: 'Greens', name: 'Greens', type: 'sequential',
    colors: {
      3: ['#e5f5e0','#a1d99b','#31a354'],
      4: ['#edf8e9','#bae4b3','#74c476','#238b45'],
      5: ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c'],
      6: ['#edf8e9','#c7e9c0','#a1d99b','#74c476','#31a354','#006d2c'],
      7: ['#edf8e9','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
      8: ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
      9: ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#00441b'],
    },
  },
  {
    id: 'Purples', name: 'Purples', type: 'sequential',
    colors: {
      3: ['#efedf5','#bcbddc','#756bb1'],
      4: ['#f2f0f7','#cbc9e2','#9e9ac8','#6a51a3'],
      5: ['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f'],
      6: ['#f2f0f7','#dadaeb','#bcbddc','#9e9ac8','#756bb1','#54278f'],
      7: ['#f2f0f7','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
      8: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
      9: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#54278f','#3f007d'],
    },
  },
  {
    id: 'Oranges', name: 'Oranges', type: 'sequential',
    colors: {
      3: ['#fee6ce','#fdae6b','#e6550d'],
      4: ['#feedde','#fdbe85','#fd8d3c','#d94701'],
      5: ['#feedde','#fdbe85','#fd8d3c','#e6550d','#a63603'],
      6: ['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#e6550d','#a63603'],
      7: ['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
      8: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
      9: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#a63603','#7f2704'],
    },
  },
  {
    id: 'BuGn', name: 'Blue-Green', type: 'sequential',
    colors: {
      3: ['#e5f5f9','#99d8c9','#2ca25f'],
      4: ['#edf8fb','#b2e2e2','#66c2a4','#238b45'],
      5: ['#edf8fb','#b2e2e2','#66c2a4','#2ca25f','#006d2c'],
      6: ['#edf8fb','#ccece6','#99d8c9','#66c2a4','#2ca25f','#006d2c'],
      7: ['#edf8fb','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
      8: ['#f7fcfd','#e5f5f9','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
      9: ['#f7fcfd','#e5f5f9','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#006d2c','#00441b'],
    },
  },
  // Diverging
  {
    id: 'RdBu', name: 'Red-Blue', type: 'diverging',
    colors: {
      3: ['#ef8a62','#f7f7f7','#67a9cf'],
      4: ['#ca0020','#f4a582','#92c5de','#0571b0'],
      5: ['#ca0020','#f4a582','#f7f7f7','#92c5de','#0571b0'],
      6: ['#b2182b','#ef8a62','#fddbc7','#d1e5f0','#67a9cf','#2166ac'],
      7: ['#b2182b','#ef8a62','#fddbc7','#f7f7f7','#d1e5f0','#67a9cf','#2166ac'],
      8: ['#b2182b','#d6604d','#f4a582','#fddbc7','#d1e5f0','#92c5de','#4393c3','#2166ac'],
      9: ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac'],
    },
  },
  {
    id: 'PiYG', name: 'Pink-Green', type: 'diverging',
    colors: {
      3: ['#e9a3c9','#f7f7f7','#a1d76a'],
      4: ['#d01c8b','#f1b6da','#b8e186','#4dac26'],
      5: ['#d01c8b','#f1b6da','#f7f7f7','#b8e186','#4dac26'],
      6: ['#c51b7d','#e9a3c9','#fde0ef','#e6f5d0','#a1d76a','#4d9221'],
      7: ['#c51b7d','#e9a3c9','#fde0ef','#f7f7f7','#e6f5d0','#a1d76a','#4d9221'],
      8: ['#c51b7d','#de77ae','#f1b6da','#fde0ef','#e6f5d0','#b8e186','#7fbc41','#4d9221'],
      9: ['#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221'],
    },
  },
  {
    id: 'BrBG', name: 'Brown-Teal', type: 'diverging',
    colors: {
      3: ['#d8b365','#f5f5f5','#5ab4ac'],
      4: ['#a6611a','#dfc27d','#80cdc1','#018571'],
      5: ['#a6611a','#dfc27d','#f5f5f5','#80cdc1','#018571'],
      6: ['#8c510a','#d8b365','#f6e8c3','#c7eae5','#5ab4ac','#01665e'],
      7: ['#8c510a','#d8b365','#f6e8c3','#f5f5f5','#c7eae5','#5ab4ac','#01665e'],
      8: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5','#80cdc1','#35978f','#01665e'],
      9: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e'],
    },
  },
  // Qualitative
  {
    id: 'Set2', name: 'Set 2', type: 'qualitative',
    colors: {
      3: ['#66c2a5','#fc8d62','#8da0cb'],
      4: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3'],
      5: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854'],
      6: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f'],
      7: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494'],
      8: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494','#b3b3b3'],
      9: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494','#b3b3b3','#8dd3c7'],
    },
  },
  {
    id: 'Paired', name: 'Paired', type: 'qualitative',
    colors: {
      3: ['#a6cee3','#1f78b4','#b2df8a'],
      4: ['#a6cee3','#1f78b4','#b2df8a','#33a02c'],
      5: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99'],
      6: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c'],
      7: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f'],
      8: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00'],
      9: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6'],
    },
  },
  {
    id: 'Dark2', name: 'Dark 2', type: 'qualitative',
    colors: {
      3: ['#1b9e77','#d95f02','#7570b3'],
      4: ['#1b9e77','#d95f02','#7570b3','#e7298a'],
      5: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e'],
      6: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02'],
      7: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d'],
      8: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666'],
      9: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666','#8dd3c7'],
    },
  },
];

/** Get a palette by ID */
export function getPaletteById(id: string): ColorPalette | undefined {
  return COLOR_PALETTES.find(p => p.id === id);
}

/** Get colors for a specific palette and number of classes */
export function getPaletteColors(id: string, numClasses: number): string[] | undefined {
  const pal = getPaletteById(id);
  if (!pal) return undefined;
  const clamped = Math.max(3, Math.min(9, numClasses));
  return pal.colors[clamped];
}
