/**
 * LayoutEngine — Builds an SVG DOM representing the full cartographic layout.
 *
 * Coordinates are in millimeters (mm) matching the page size.
 * The SVG viewBox is set to page dimensions in mm, so 1 SVG unit = 1 mm.
 */

import type { LayoutState, ElementOverrides, LegendEntry, DrawingAnnotation, ImageAnnotation, GridSettings, NorthArrowStyle, MapFrameBorderStyle, WatermarkSettings, CalloutAnnotation, ScaleTextSettings, DisclaimerBoxSettings, QRCodeSettings, LocatorMapSettings, SymbolAnnotation, DataTableSettings, CustomFont, HatchPattern } from '../types/layout';
import type { UserDataLayer } from '../types/userdata';
import type { CRSInfo, ScaleBarInfo, BBox } from '../types/geo';
import { formatCRSBlock } from '../geo/projections';
import { formatRepresentativeFraction } from '../geo/scale';
import { generateQRCode } from '../geo/qrcode';
import { projectWorldToSVG } from '../data/worldOutline';
import { getSymbolById } from '../data/symbolLibrary';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes */
function svgEl(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/** Create an SVG text element */
function svgText(
  x: number,
  y: number,
  text: string,
  opts: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    fill?: string;
    anchor?: string;
  } = {}
): SVGTextElement {
  const el = svgEl('text', {
    x,
    y,
    'font-size': opts.fontSize ?? 3,
    'font-family': opts.fontFamily ?? "'Noto Sans', Arial, Helvetica, sans-serif",
    'font-weight': opts.fontWeight ?? 'normal',
    'font-style': opts.fontStyle ?? 'normal',
    fill: opts.fill ?? '#1a1a1a',
    'text-anchor': opts.anchor ?? 'start',
  }) as SVGTextElement;
  el.textContent = text;
  return el;
}

export interface LayoutConfig {
  pageWidthMM: number;
  pageHeightMM: number;
  marginMM: number;
}

/** Compute default element positions based on page dimensions */
export function computeDefaultOverrides(config: LayoutConfig): ElementOverrides {
  const { pageWidthMM, pageHeightMM, marginMM } = config;
  const mainFrameBottom = marginMM + 3 + (pageHeightMM - marginMM * 2 - 30);
  const mainFrameRight = marginMM + 50 + (pageWidthMM - marginMM * 2 - 55);
  const mainFrameX = marginMM + 50;
  const mainFrameCenterX = mainFrameX + (mainFrameRight - mainFrameX) / 2;
  return {
    northArrow: {
      visible: true,
      position: { x: mainFrameRight - 10, y: marginMM + 8 },
      scale: 1,
    },
    titleBlock: {
      position: { x: mainFrameCenterX, y: mainFrameBottom + 5 },
      fontSize: 5.5,
    },
    scaleBar: {
      visible: true,
      position: { x: mainFrameRight - 70, y: mainFrameBottom + 12 },
    },
    legend: {
      visible: true,
      position: { x: pageWidthMM - marginMM - 55, y: mainFrameBottom - 30 },
      scale: 1,
    },
  };
}

/**
 * Main layout builder. Assembles the entire layout SVG from state.
 */
export function buildLayoutSVG(state: LayoutState, config: LayoutConfig): SVGSVGElement {
  const { pageWidthMM, pageHeightMM, marginMM } = config;
  const hasCropMarks = state.cropMarks === true;
  const cropBleed = hasCropMarks ? 10 : 0; // 10mm bleed area

  // Root SVG
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  if (hasCropMarks) {
    svg.setAttribute('viewBox', `${-cropBleed} ${-cropBleed} ${pageWidthMM + cropBleed * 2} ${pageHeightMM + cropBleed * 2}`);
    svg.setAttribute('width', `${pageWidthMM + cropBleed * 2}mm`);
    svg.setAttribute('height', `${pageHeightMM + cropBleed * 2}mm`);
  } else {
    svg.setAttribute('viewBox', `0 0 ${pageWidthMM} ${pageHeightMM}`);
    svg.setAttribute('width', `${pageWidthMM}mm`);
    svg.setAttribute('height', `${pageHeightMM}mm`);
  }
  svg.setAttribute('style', 'background: white;');

  // Define embedded font style
  const defs = svgEl('defs');
  const style = svgEl('style');
  let fontImports = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
    text { font-family: 'Noto Sans', Arial, Helvetica, sans-serif; }`;
  // Custom font @font-face declarations
  if (state.customFonts) {
    for (const cf of state.customFonts) {
      fontImports += `\n    @font-face { font-family: '${cf.name}'; src: url(${cf.dataUrl}) format('${cf.format}'); }`;
    }
  }
  style.textContent = fontImports;
  defs.appendChild(style);

  // Hatch pattern definitions
  buildHatchPatternDefs(defs);

  svg.appendChild(defs);

  // 1. Neatline
  svg.appendChild(buildNeatline(pageWidthMM, pageHeightMM, marginMM));

  // 2. Main map frame
  const mainFrame = {
    x: marginMM + 50,
    y: marginMM + 3,
    width: pageWidthMM - marginMM * 2 - 55,
    height: pageHeightMM - marginMM * 2 - 30,
  };
  const borderStyle = state.frameBorderStyle || 'simple';
  svg.appendChild(buildMapFrame(mainFrame, state.renderedMaps.main, 'main-map', borderStyle, defs));

  // 2b. Coordinate grid overlay on main map
  if (state.grid?.visible && state.mainMapBBox) {
    svg.appendChild(buildCoordinateGrid(mainFrame, state.mainMapBBox, state.grid));
  }

  // 3. Inset map 1: country overview
  const countryLabel = state.insetLabels?.country || 'Country Overview';
  const stateLabel = state.insetLabels?.state || 'Regional Overview';

  const inset1Frame = {
    x: marginMM + 3,
    y: marginMM + 8,
    width: 42,
    height: 38,
  };
  svg.appendChild(buildMapFrame(inset1Frame, state.renderedMaps.insetCountry, 'inset-country', borderStyle, defs));

  // Inset 1 label
  svg.appendChild(svgText(
    inset1Frame.x + inset1Frame.width / 2,
    inset1Frame.y - 1,
    countryLabel,
    { fontSize: 2.2, anchor: 'middle', fill: '#555' }
  ));

  // 4. Inset map 2: state/region
  const inset2Frame = {
    x: marginMM + 3,
    y: inset1Frame.y + inset1Frame.height + 14,
    width: 42,
    height: 38,
  };
  svg.appendChild(buildMapFrame(inset2Frame, state.renderedMaps.insetState, 'inset-state', borderStyle, defs));

  svg.appendChild(svgText(
    inset2Frame.x + inset2Frame.width / 2,
    inset2Frame.y - 1,
    stateLabel,
    { fontSize: 2.2, anchor: 'middle', fill: '#555' }
  ));

  // 5. Connector lines (inset extent boxes → main map frame)
  if (state.aoi) {
    svg.appendChild(buildConnectorLines(inset1Frame, mainFrame));
    svg.appendChild(buildConnectorLines(inset2Frame, mainFrame));
  }

  // Resolve element overrides
  const ov = state.elementOverrides ?? computeDefaultOverrides(config);

  // 6. Title block
  svg.appendChild(buildTitleBlock(
    ov.titleBlock.position.x,
    ov.titleBlock.position.y,
    state.fields.title,
    state.fields.subtitle,
    ov.titleBlock.fontSize
  ));

  // 7. North arrow
  if (ov.northArrow.visible) {
    const baseW = 8, baseH = 12;
    const naStyle = ov.northArrow.style || 'simple';
    svg.appendChild(buildNorthArrow(
      ov.northArrow.position.x,
      ov.northArrow.position.y,
      baseW * ov.northArrow.scale,
      baseH * ov.northArrow.scale,
      naStyle
    ));
  }

  // 8. Scale bar
  if (ov.scaleBar.visible && state.scaleBar) {
    svg.appendChild(buildScaleBar(
      ov.scaleBar.position.x,
      ov.scaleBar.position.y,
      state.scaleBar
    ));
  }

  // 9. Legend
  if (ov.legend.visible) {
    svg.appendChild(buildLegend(
      ov.legend.position.x,
      ov.legend.position.y,
      state.activeLayers,
      state.userLayers?.filter(l => l.visible),
      ov.legend.scale ?? 1,
      state.customLegendEntries
    ));
  }

  // 10. CRS metadata block
  if (state.crs) {
    const mainFrameBottomY = mainFrame.y + mainFrame.height;
    svg.appendChild(buildCRSBlock(
      marginMM + 3,
      mainFrameBottomY + 13,
      state.crs
    ));
  }

  // 11. Author / date line
  const authorDate = [state.fields.author, state.fields.date]
    .filter(Boolean)
    .join(' | ');
  if (authorDate) {
    svg.appendChild(svgText(
      marginMM + 3,
      pageHeightMM - marginMM - 2,
      `Author: ${authorDate}`,
      { fontSize: 1.8, fill: '#666' }
    ));
  }

  // 12. Attribution
  svg.appendChild(svgText(
    pageWidthMM - marginMM - 2,
    pageHeightMM - marginMM - 2,
    'Basemap: OpenStreetMap contributors | Boundaries: Natural Earth (public domain)',
    { fontSize: 1.4, fill: '#aaa', anchor: 'end' }
  ));

  // 13. Custom text annotations
  if (state.customTexts) {
    for (const ct of state.customTexts) {
      if (ct.text.trim()) {
        const ctGroup = svgEl('g', {
          'data-custom-text': ct.id,
          transform: `translate(${ct.position.x},${ct.position.y})`,
          ...(ct.locked ? { 'data-locked': 'true' } : {}),
        });
        ctGroup.appendChild(svgText(0, 0, ct.text, {
          fontSize: ct.fontSize,
          fontWeight: ct.fontWeight,
          fontStyle: ct.fontStyle || 'normal',
          fontFamily: ct.fontFamily || "'Noto Sans', Arial, Helvetica, sans-serif",
          fill: ct.color,
        }));
        svg.appendChild(ctGroup);
      }
    }
  }

  // 14. Drawing annotations
  if (state.drawings) {
    for (const d of state.drawings) {
      svg.appendChild(buildDrawingShape(d));
    }
  }

  // 15. Logo / image annotations
  if (state.logoImages) {
    for (const img of state.logoImages) {
      svg.appendChild(buildImageAnnotation(img));
    }
  }

  // 16. Callout annotations
  if (state.callouts) {
    for (const ca of state.callouts) {
      if (ca.targetSVG) {
        svg.appendChild(buildCalloutAnnotation(ca));
      }
    }
  }

  // 17. Scale Text block
  if (state.scaleText?.visible && state.scaleBar) {
    const stPos = state.scaleText.position;
    svg.appendChild(buildScaleTextBlock(stPos.x, stPos.y, state.scaleBar, pageWidthMM > pageHeightMM ? 'A3' : 'A4', state.scaleText.fontSize));
  }

  // 18. Disclaimer / Data Sources box
  if (state.disclaimerBox?.visible) {
    svg.appendChild(buildDisclaimerBox(state.disclaimerBox));
  }

  // 19. QR Code
  if (state.qrCode?.visible && state.qrCode.url) {
    svg.appendChild(buildQRCode(state.qrCode.position, state.qrCode.size, state.qrCode.url));
  }

  // 20. Overview Locator Map
  if (state.locatorMap?.visible && state.mainMapBBox) {
    svg.appendChild(buildLocatorMap(state.locatorMap.position, state.locatorMap.size, state.mainMapBBox));
  }

  // 21. Symbol annotations
  if (state.symbols) {
    for (const sym of state.symbols) {
      if (sym.targetSVG) {
        svg.appendChild(buildSymbolMarker(sym));
      }
    }
  }

  // 22. Data Table
  if (state.dataTable?.visible && state.dataTable.headers.length > 0) {
    svg.appendChild(buildDataTable(state.dataTable));
  }

  // 23. Atlas page label
  if (state.atlas?.enabled) {
    const pageNum = state.atlas.currentPage;
    const totalPages = state.atlas.totalPages;
    const cols = state.atlas.cols;
    const row = Math.floor(pageNum / cols);
    const col = pageNum % cols;
    const gridRef = `${String.fromCharCode(65 + row)}${col + 1}`;
    svg.appendChild(buildAtlasPageLabel(
      pageWidthMM / 2, pageHeightMM - marginMM - 1,
      pageNum + 1, gridRef, totalPages
    ));
  }

  // 24. Watermark (on top of everything)
  if (state.watermark?.enabled && state.watermark.text) {
    svg.appendChild(buildWatermark(pageWidthMM, pageHeightMM, state.watermark));
  }

  // 25. Crop & bleed marks (outside page area)
  if (hasCropMarks) {
    svg.appendChild(buildCropMarks(pageWidthMM, pageHeightMM));
  }

  return svg;
}

/** Build the neatline (page border) */
function buildNeatline(w: number, h: number, margin: number): SVGElement {
  return svgEl('rect', {
    x: margin,
    y: margin,
    width: w - margin * 2,
    height: h - margin * 2,
    fill: 'none',
    stroke: '#000',
    'stroke-width': 0.5,
  });
}

/** Build a map frame (border + optional raster image) */
function buildMapFrame(
  frame: { x: number; y: number; width: number; height: number },
  imageDataUrl: string | null,
  id: string,
  borderStyle: MapFrameBorderStyle = 'simple',
  defsEl?: SVGElement
): SVGElement {
  const g = svgEl('g', { id, 'data-map-frame': id });

  const useRounded = borderStyle === 'rounded';
  const roundR = 3;

  // Always create a clipPath to prevent map image bleed outside frame
  let contentTarget: SVGElement = g;
  if (defsEl) {
    const clipId = `frame-clip-${id}`;
    const clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('rect', {
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height,
      ...(useRounded ? { rx: roundR, ry: roundR } : {}),
    }));
    defsEl.appendChild(clip);
    const contentGroup = svgEl('g', { 'clip-path': `url(#${clipId})` });
    contentTarget = contentGroup;
  }

  // Shadow (behind everything for 'shadow' style)
  if (borderStyle === 'shadow') {
    g.appendChild(svgEl('rect', {
      x: frame.x + 1, y: frame.y + 1,
      width: frame.width, height: frame.height,
      fill: '#b0b0b0', rx: 0, ry: 0,
    }));
  }

  // Background (inside clipped group)
  contentTarget.appendChild(svgEl('rect', {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    fill: '#e8edf2',
    ...(useRounded ? { rx: roundR, ry: roundR } : {}),
  }));

  // Map image (if rendered, inside clipped group)
  if (imageDataUrl) {
    const img = svgEl('image', {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      preserveAspectRatio: 'xMidYMid slice',
    });
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageDataUrl);
    contentTarget.appendChild(img);
  } else {
    contentTarget.appendChild(svgText(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      'Map will render here',
      { fontSize: 3, fill: '#aaa', anchor: 'middle' }
    ));
  }

  // Add clipped content group to main group (after shadow, before borders)
  if (contentTarget !== g) {
    g.appendChild(contentTarget);
  }

  // Border based on style
  if (borderStyle === 'none') {
    // No border
  } else if (borderStyle === 'double') {
    // Outer border
    g.appendChild(svgEl('rect', {
      x: frame.x - 0.8, y: frame.y - 0.8,
      width: frame.width + 1.6, height: frame.height + 1.6,
      fill: 'none', stroke: '#000', 'stroke-width': 0.3,
    }));
    // Inner border
    g.appendChild(svgEl('rect', {
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height,
      fill: 'none', stroke: '#000', 'stroke-width': 0.3,
    }));
  } else if (borderStyle === 'neatline-ticks') {
    // Border
    g.appendChild(svgEl('rect', {
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height,
      fill: 'none', stroke: '#000', 'stroke-width': 0.3,
    }));
    // Tick marks every 10mm
    const tickLen = 1.5;
    for (let dx = 0; dx <= frame.width; dx += 10) {
      // Top ticks
      g.appendChild(svgEl('line', {
        x1: frame.x + dx, y1: frame.y - tickLen,
        x2: frame.x + dx, y2: frame.y,
        stroke: '#000', 'stroke-width': 0.2,
      }));
      // Bottom ticks
      g.appendChild(svgEl('line', {
        x1: frame.x + dx, y1: frame.y + frame.height,
        x2: frame.x + dx, y2: frame.y + frame.height + tickLen,
        stroke: '#000', 'stroke-width': 0.2,
      }));
    }
    for (let dy = 0; dy <= frame.height; dy += 10) {
      // Left ticks
      g.appendChild(svgEl('line', {
        x1: frame.x - tickLen, y1: frame.y + dy,
        x2: frame.x, y2: frame.y + dy,
        stroke: '#000', 'stroke-width': 0.2,
      }));
      // Right ticks
      g.appendChild(svgEl('line', {
        x1: frame.x + frame.width, y1: frame.y + dy,
        x2: frame.x + frame.width + tickLen, y2: frame.y + dy,
        stroke: '#000', 'stroke-width': 0.2,
      }));
    }
  } else {
    // 'simple', 'shadow', 'rounded' all get a basic border
    g.appendChild(svgEl('rect', {
      x: frame.x, y: frame.y,
      width: frame.width, height: frame.height,
      fill: 'none', stroke: '#000', 'stroke-width': 0.3,
      ...(useRounded ? { rx: roundR, ry: roundR } : {}),
    }));
  }

  return g;
}

/** Build connector lines from an inset frame to the main map frame */
function buildConnectorLines(
  insetFrame: { x: number; y: number; width: number; height: number },
  mainFrame: { x: number; y: number; width: number; height: number }
): SVGElement {
  const g = svgEl('g', { class: 'connectors' });

  // Top-right corner of inset → top-left corner of main
  g.appendChild(svgEl('line', {
    x1: insetFrame.x + insetFrame.width,
    y1: insetFrame.y,
    x2: mainFrame.x,
    y2: mainFrame.y,
    stroke: '#cc0000',
    'stroke-width': 0.25,
    'stroke-dasharray': '2,1',
  }));

  // Bottom-right corner of inset → matching point on main
  g.appendChild(svgEl('line', {
    x1: insetFrame.x + insetFrame.width,
    y1: insetFrame.y + insetFrame.height,
    x2: mainFrame.x,
    y2: mainFrame.y + mainFrame.height,
    stroke: '#cc0000',
    'stroke-width': 0.25,
    'stroke-dasharray': '2,1',
  }));

  return g;
}

/** Build the title block */
function buildTitleBlock(
  x: number,
  y: number,
  title: string,
  subtitle: string,
  fontSize: number = 5.5
): SVGElement {
  const g = svgEl('g', { class: 'title-block', 'data-element': 'titleBlock', transform: `translate(${x},${y})` });

  g.appendChild(svgText(0, 0, title || 'Study Area Map', {
    fontSize,
    fontWeight: '700',
    anchor: 'middle',
  }));

  if (subtitle) {
    const subtitleSize = fontSize * (3 / 5.5);
    g.appendChild(svgText(0, fontSize + 0.5, subtitle, {
      fontSize: subtitleSize,
      fontWeight: '400',
      fill: '#444',
      anchor: 'middle',
    }));
  }

  return g;
}

/** Build the north arrow with style selection */
function buildNorthArrow(x: number, y: number, w: number, h: number, style: NorthArrowStyle = 'simple'): SVGElement {
  const g = svgEl('g', { class: 'north-arrow', 'data-element': 'northArrow', transform: `translate(${x},${y})` });

  switch (style) {
    case 'compass-rose':
      buildNorthArrowCompassRose(g, w, h);
      break;
    case 'ornate':
      buildNorthArrowOrnate(g, w, h);
      break;
    case 'minimal':
      buildNorthArrowMinimal(g, w, h);
      break;
    case 'nato':
      buildNorthArrowNato(g, w, h);
      break;
    case 'modern':
      buildNorthArrowModern(g, w, h);
      break;
    case 'vintage':
      buildNorthArrowVintage(g, w, h);
      break;
    default: // 'simple'
      buildNorthArrowSimple(g, w, h);
      break;
  }

  return g;
}

function buildNorthArrowSimple(g: SVGElement, w: number, h: number): void {
  const nFontSize = w * 0.375;
  g.appendChild(svgText(w / 2, nFontSize * 0.83, 'N', {
    fontSize: nFontSize, fontWeight: '700', anchor: 'middle',
  }));
  g.appendChild(svgEl('polygon', {
    points: `${w / 2},3.5 ${w * 0.8},${h - 1} ${w / 2},${h - 3}`,
    fill: '#1a1a1a',
  }));
  g.appendChild(svgEl('polygon', {
    points: `${w / 2},3.5 ${w * 0.2},${h - 1} ${w / 2},${h - 3}`,
    fill: '#fff', stroke: '#1a1a1a', 'stroke-width': 0.3,
  }));
}

function buildNorthArrowCompassRose(g: SVGElement, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.42;
  // Circle ring
  g.appendChild(svgEl('circle', { cx, cy, r: r * 1.05, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 0.3 }));
  // 8-point star
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45 - 90) * Math.PI / 180;
    const tipR = i % 2 === 0 ? r : r * 0.5;
    const tx = cx + tipR * Math.cos(angle);
    const ty = cy + tipR * Math.sin(angle);
    const a1 = angle - 0.3, a2 = angle + 0.3;
    const baseR = r * 0.15;
    const b1x = cx + baseR * Math.cos(a1), b1y = cy + baseR * Math.sin(a1);
    const b2x = cx + baseR * Math.cos(a2), b2y = cy + baseR * Math.sin(a2);
    g.appendChild(svgEl('polygon', {
      points: `${tx},${ty} ${b1x},${b1y} ${b2x},${b2y}`,
      fill: i % 2 === 0 ? '#1a1a1a' : '#999',
      stroke: '#1a1a1a', 'stroke-width': 0.15,
    }));
  }
  // Cardinal labels
  const labelR = r * 1.3;
  const fontSize = w * 0.2;
  for (let i = 0; i < 4; i++) {
    const angle = (i * 90 - 90) * Math.PI / 180;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle) + fontSize * 0.35;
    g.appendChild(svgText(lx, ly, dirs[i * 2], {
      fontSize, fontWeight: '700', anchor: 'middle',
    }));
  }
}

function buildNorthArrowOrnate(g: SVGElement, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  // Outer decorative circle
  g.appendChild(svgEl('circle', { cx, cy, r: r * 1.2, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 0.4 }));
  g.appendChild(svgEl('circle', { cx, cy, r: r * 1.1, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 0.15 }));
  // Fleur-de-lis inspired north pointer
  g.appendChild(svgEl('polygon', {
    points: `${cx},${cy - r} ${cx + r * 0.25},${cy} ${cx},${cy - r * 0.3}`,
    fill: '#1a1a1a',
  }));
  g.appendChild(svgEl('polygon', {
    points: `${cx},${cy - r} ${cx - r * 0.25},${cy} ${cx},${cy - r * 0.3}`,
    fill: '#fff', stroke: '#1a1a1a', 'stroke-width': 0.2,
  }));
  // South pointer
  g.appendChild(svgEl('polygon', {
    points: `${cx},${cy + r} ${cx + r * 0.2},${cy} ${cx - r * 0.2},${cy}`,
    fill: '#999', stroke: '#1a1a1a', 'stroke-width': 0.15,
  }));
  // N label
  const fs = w * 0.3;
  g.appendChild(svgText(cx, cy - r - fs * 0.3, 'N', {
    fontSize: fs, fontWeight: '700', anchor: 'middle',
    fontFamily: "'Times New Roman', Georgia, serif",
  }));
}

function buildNorthArrowMinimal(g: SVGElement, w: number, h: number): void {
  const cx = w / 2;
  // Thin vertical line
  g.appendChild(svgEl('line', {
    x1: cx, y1: h * 0.25, x2: cx, y2: h * 0.95,
    stroke: '#1a1a1a', 'stroke-width': 0.4,
  }));
  // Small arrowhead
  g.appendChild(svgEl('polygon', {
    points: `${cx},${h * 0.2} ${cx - w * 0.12},${h * 0.35} ${cx + w * 0.12},${h * 0.35}`,
    fill: '#1a1a1a',
  }));
  // Small N
  const fs = w * 0.25;
  g.appendChild(svgText(cx, h * 0.15, 'N', {
    fontSize: fs, fontWeight: '600', anchor: 'middle',
  }));
}

function buildNorthArrowNato(g: SVGElement, w: number, h: number): void {
  const cx = w / 2;
  // Filled triangle (NATO style)
  g.appendChild(svgEl('polygon', {
    points: `${cx},${h * 0.15} ${cx + w * 0.35},${h * 0.85} ${cx - w * 0.35},${h * 0.85}`,
    fill: '#1a1a1a', stroke: '#1a1a1a', 'stroke-width': 0.2,
  }));
  // Horizontal crossbar
  g.appendChild(svgEl('line', {
    x1: cx - w * 0.3, y1: h * 0.6,
    x2: cx + w * 0.3, y2: h * 0.6,
    stroke: '#fff', 'stroke-width': 0.5,
  }));
  // N label
  const fs = w * 0.3;
  g.appendChild(svgText(cx, h * 0.1, 'N', {
    fontSize: fs, fontWeight: '700', anchor: 'middle',
  }));
}

function buildNorthArrowModern(g: SVGElement, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.2;
  // Circle
  g.appendChild(svgEl('circle', { cx, cy: cy + r * 0.5, r, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 0.3 }));
  // Clean geometric triangle
  g.appendChild(svgEl('polygon', {
    points: `${cx},${h * 0.1} ${cx + w * 0.22},${cy - r * 0.3} ${cx - w * 0.22},${cy - r * 0.3}`,
    fill: '#1a1a1a',
  }));
  // South indicator
  g.appendChild(svgEl('line', {
    x1: cx, y1: cy + r * 0.5 + r,
    x2: cx, y2: h * 0.9,
    stroke: '#1a1a1a', 'stroke-width': 0.3,
  }));
  // N label
  const fs = w * 0.28;
  g.appendChild(svgText(cx, h * 0.07, 'N', {
    fontSize: fs, fontWeight: '700', anchor: 'middle',
  }));
}

function buildNorthArrowVintage(g: SVGElement, w: number, h: number): void {
  const cx = w / 2;
  // Ornamental arrow body
  g.appendChild(svgEl('polygon', {
    points: `${cx},${h * 0.2} ${cx + w * 0.3},${h * 0.75} ${cx},${h * 0.6}`,
    fill: '#3d2b1f',
  }));
  g.appendChild(svgEl('polygon', {
    points: `${cx},${h * 0.2} ${cx - w * 0.3},${h * 0.75} ${cx},${h * 0.6}`,
    fill: '#f5e6d3', stroke: '#3d2b1f', 'stroke-width': 0.3,
  }));
  // Decorative base circle
  g.appendChild(svgEl('circle', {
    cx, cy: h * 0.78, r: w * 0.12,
    fill: '#f5e6d3', stroke: '#3d2b1f', 'stroke-width': 0.3,
  }));
  // Serif N
  const fs = w * 0.35;
  g.appendChild(svgText(cx, h * 0.15, 'N', {
    fontSize: fs, fontWeight: '700', anchor: 'middle',
    fontFamily: "'Times New Roman', Georgia, serif",
    fill: '#3d2b1f',
  }));
}

/** Build the scale bar */
function buildScaleBar(x: number, y: number, info: ScaleBarInfo): SVGElement {
  const g = svgEl('g', { class: 'scale-bar', 'data-element': 'scaleBar', transform: `translate(${x},${y})` });

  const barHeight = 2;
  const totalWidth = info.widthMM;
  const divisions = 4;
  const divWidth = totalWidth / divisions;

  // Alternating black/white bars
  for (let i = 0; i < divisions; i++) {
    g.appendChild(svgEl('rect', {
      x: i * divWidth,
      y: 0,
      width: divWidth,
      height: barHeight,
      fill: i % 2 === 0 ? '#1a1a1a' : '#ffffff',
      stroke: '#1a1a1a',
      'stroke-width': 0.2,
    }));
  }

  // Labels: 0, midpoint, end
  g.appendChild(svgText(0, -1, '0', { fontSize: 2, anchor: 'middle' }));
  g.appendChild(svgText(totalWidth / 2, -1,
    formatDistanceLabel(info.distanceMeters / 2),
    { fontSize: 2, anchor: 'middle' }
  ));
  g.appendChild(svgText(totalWidth, -1, info.label, { fontSize: 2, anchor: 'middle' }));

  // Representative fraction below
  g.appendChild(svgText(totalWidth / 2, barHeight + 3,
    formatRepresentativeFraction(info.representativeFraction),
    { fontSize: 2, anchor: 'middle', fill: '#555' }
  ));

  return g;
}

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km}` : `${km.toFixed(1)}`;
  }
  return `${meters}`;
}

/** Build the legend */
function buildLegend(
  x: number,
  y: number,
  activeLayers: string[],
  userLayers?: UserDataLayer[],
  scale: number = 1,
  customEntries?: LegendEntry[]
): SVGElement {
  const g = svgEl('g', { class: 'legend', 'data-element': 'legend', transform: `translate(${x},${y})` });

  const s = scale;
  const padding = 2 * s;
  const swatchSize = 3.5 * s;
  const lineHeight = 5 * s;
  const legendWidth = 50 * s;
  const titleFontSize = 2.5 * s;
  const labelFontSize = 2 * s;

  // Determine items: custom entries take priority if present
  type LegendItem = { color: string; type: 'fill' | 'line' | 'circle'; label: string; pattern?: HatchPattern };
  let allItems: LegendItem[];

  if (customEntries && customEntries.length > 0) {
    allItems = customEntries
      .filter(e => e.visible)
      .map(e => ({ color: e.color, type: e.type, label: e.label, pattern: e.pattern }));
  } else {
    // Layer display config
    const layerStyles: Record<string, LegendItem> = {
      basemap: { color: '#e8edf2', type: 'fill', label: 'Basemap' },
      boundaries: { color: '#888', type: 'line', label: 'Country Boundaries' },
      states: { color: '#aaa', type: 'line', label: 'State Boundaries' },
      'aoi-boundary': { color: '#2563eb', type: 'fill', label: 'Study Area' },
      rivers: { color: '#3b82f6', type: 'line', label: 'Rivers' },
      settlements: { color: '#333', type: 'circle', label: 'Settlements' },
    };

    const items = activeLayers
      .map(id => layerStyles[id])
      .filter(Boolean);

    // Add user data layers to legend items
    const userItems: LegendItem[] = [];
    if (userLayers) {
      for (const ul of userLayers) {
        const type: 'fill' | 'line' | 'circle' =
          ul.geometryType === 'Point' ? 'circle' :
          ul.geometryType === 'LineString' ? 'line' : 'fill';
        userItems.push({ color: ul.color, type, label: ul.legendLabel });
      }
    }

    allItems = [...items, ...userItems];
  }

  const legendHeight = padding * 2 + 5 * s + allItems.length * lineHeight;

  // Background box
  g.appendChild(svgEl('rect', {
    x: 0,
    y: 0,
    width: legendWidth,
    height: legendHeight,
    fill: '#ffffff',
    stroke: '#999',
    'stroke-width': 0.2 * s,
    rx: 1 * s,
  }));

  // Title
  g.appendChild(svgText(padding, padding + 3 * s, 'Legend', {
    fontSize: titleFontSize,
    fontWeight: '700',
  }));

  // Items
  allItems.forEach((item, i) => {
    const itemY = padding + 7 * s + i * lineHeight;

    if (item.type === 'fill') {
      const fillVal = (item.pattern && item.pattern !== 'none')
        ? `url(#pattern-${item.pattern})`
        : item.color;
      g.appendChild(svgEl('rect', {
        x: padding,
        y: itemY - swatchSize / 2,
        width: swatchSize,
        height: swatchSize,
        fill: fillVal,
        stroke: '#666',
        'stroke-width': 0.15 * s,
        opacity: 0.6,
        ...(item.pattern && item.pattern !== 'none' ? { color: item.color } : {}),
      }));
    } else if (item.type === 'line') {
      g.appendChild(svgEl('line', {
        x1: padding,
        y1: itemY + swatchSize / 4,
        x2: padding + swatchSize,
        y2: itemY + swatchSize / 4,
        stroke: item.color,
        'stroke-width': 0.6 * s,
      }));
    } else if (item.type === 'circle') {
      g.appendChild(svgEl('circle', {
        cx: padding + swatchSize / 2,
        cy: itemY + swatchSize / 4,
        r: swatchSize / 3,
        fill: item.color,
      }));
    }

    g.appendChild(svgText(padding + swatchSize + 2 * s, itemY + swatchSize / 2 + 0.5 * s, item.label, {
      fontSize: labelFontSize,
    }));
  });

  return g;
}

/** Build the CRS metadata block */
function buildCRSBlock(x: number, y: number, crs: CRSInfo): SVGElement {
  const g = svgEl('g', { class: 'crs-block', transform: `translate(${x},${y})` });

  const lines = formatCRSBlock(crs);
  lines.forEach((line, i) => {
    g.appendChild(svgText(0, i * 2.5, line, {
      fontSize: 1.6,
      fontFamily: "'Courier New', 'Consolas', monospace",
      fill: '#555',
    }));
  });

  return g;
}

// ─── Coordinate Grid ─────────────────────────────────────────────────

/** Choose a nice grid interval in decimal degrees based on the visible span */
function chooseGridInterval(spanDeg: number): number {
  // Target ~4-6 grid lines. Intervals are in degrees.
  // Use DMS-friendly intervals: multiples of seconds, minutes, degrees.
  const candidates = [
    0.0005,           //  ~1.8"
    0.001,            //  ~3.6"
    0.0025,           //  ~9"
    0.005,            //  ~18"
    1 / 120,          //  30"
    1 / 60,           //  1'
    2 / 60,           //  2'
    5 / 60,           //  5'
    10 / 60,          //  10'
    15 / 60,          //  15'
    30 / 60,          //  30'
    1,                //  1°
    2,                //  2°
    5,                //  5°
    10,               //  10°
    15,               //  15°
    30,               //  30°
  ];
  const target = spanDeg / 5;
  let best = candidates[0];
  let bestDiff = Math.abs(best - target);
  for (const c of candidates) {
    const diff = Math.abs(c - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

/** Convert decimal degrees to DD°MM'SS" string */
function formatDMS(decDeg: number, isLat: boolean): string {
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);

  // Handle carry
  let dd = d, mm = m, ss = s;
  if (ss === 60) { ss = 0; mm += 1; }
  if (mm === 60) { mm = 0; dd += 1; }

  const dir = isLat ? (decDeg >= 0 ? 'N' : 'S') : (decDeg >= 0 ? 'E' : 'W');

  if (dd === 0 && mm === 0 && ss === 0) return `0°${dir}`;
  if (ss === 0 && mm === 0) return `${dd}°${dir}`;
  if (ss === 0) return `${dd}°${mm < 10 ? '0' : ''}${mm}'${dir}`;
  return `${dd}°${mm < 10 ? '0' : ''}${mm}'${ss < 10 ? '0' : ''}${ss}"${dir}`;
}

/** Build coordinate grid with DD°MM'SS" labels around the main map frame.
 *  Longitude labels (top/bottom) are horizontal.
 *  Latitude labels (left/right) are rotated vertically — standard cartographic convention. */
function buildCoordinateGrid(
  frame: { x: number; y: number; width: number; height: number },
  bbox: BBox,
  settings: GridSettings
): SVGElement {
  const g = svgEl('g', { class: 'coordinate-grid' });

  const lngSpan = bbox.east - bbox.west;
  const latSpan = bbox.north - bbox.south;
  const lngInterval = chooseGridInterval(lngSpan);
  const latInterval = chooseGridInterval(latSpan);

  // Pull styling from settings
  const gridLineStyle: Record<string, string | number> = {
    stroke: settings.color,
    'stroke-width': settings.lineWidth,
    'stroke-opacity': settings.opacity,
  };

  const tickLen = 1.2;
  const tickWidth = Math.max(settings.lineWidth * 2, 0.12);
  const labelFontSize = settings.labelSize;
  const labelColor = settings.labelColor;
  const labelGap = 1.2;
  const labelFont = "'Noto Sans', Arial, sans-serif";

  // Helper: geo → mm position inside frame
  const lngToX = (lng: number) => frame.x + ((lng - bbox.west) / lngSpan) * frame.width;
  const latToY = (lat: number) => frame.y + ((bbox.north - lat) / latSpan) * frame.height;

  // Compute meridian (vertical) lines — use Set to deduplicate
  const firstLng = Math.ceil(bbox.west / lngInterval) * lngInterval;
  const meridianSet = new Set<number>();
  for (let lng = firstLng; lng <= bbox.east + lngInterval * 0.01; lng += lngInterval) {
    const val = Math.round(lng / lngInterval) * lngInterval;
    if (val > bbox.west + lngSpan * 0.01 && val < bbox.east - lngSpan * 0.01) {
      meridianSet.add(parseFloat(val.toFixed(10)));
    }
  }
  const meridians = [...meridianSet].sort((a, b) => a - b);

  // Compute parallel (horizontal) lines
  const firstLat = Math.ceil(bbox.south / latInterval) * latInterval;
  const parallelSet = new Set<number>();
  for (let lat = firstLat; lat <= bbox.north + latInterval * 0.01; lat += latInterval) {
    const val = Math.round(lat / latInterval) * latInterval;
    if (val > bbox.south + latSpan * 0.01 && val < bbox.north - latSpan * 0.01) {
      parallelSet.add(parseFloat(val.toFixed(10)));
    }
  }
  const parallels = [...parallelSet].sort((a, b) => a - b);

  // Clip group to map frame area
  const clipId = `grid-clip-${Date.now()}`;
  const clipPath = svgEl('clipPath', { id: clipId });
  clipPath.appendChild(svgEl('rect', {
    x: frame.x, y: frame.y, width: frame.width, height: frame.height,
  }));
  g.appendChild(clipPath);

  const gridLinesGroup = svgEl('g', { 'clip-path': `url(#${clipId})` });

  // Draw meridians (vertical grid lines)
  for (const lng of meridians) {
    const x = lngToX(lng);
    gridLinesGroup.appendChild(svgEl('line', {
      x1: x, y1: frame.y,
      x2: x, y2: frame.y + frame.height,
      ...gridLineStyle,
    }));
  }

  // Draw parallels (horizontal grid lines)
  for (const lat of parallels) {
    const y = latToY(lat);
    gridLinesGroup.appendChild(svgEl('line', {
      x1: frame.x, y1: y,
      x2: frame.x + frame.width, y2: y,
      ...gridLineStyle,
    }));
  }

  g.appendChild(gridLinesGroup);

  // ── Tick marks and labels on all 4 sides ──

  const tickColor = labelColor;
  const inside = settings.labelPlacement === 'inside';

  // Inset padding for inside labels (distance from frame edge)
  const insetPad = labelFontSize * 0.4;
  // Background halo padding around label text
  const haloPadX = labelFontSize * 0.3;
  const haloPadY = labelFontSize * 0.15;

  /** Helper: add a white halo background rect behind a text element (for inside labels).
   *  The halo is added to the parent group, then the text is appended on top. */
  const addLabelWithHalo = (parent: SVGElement, textEl: SVGElement) => {
    if (inside) {
      // We need to estimate text width. Average char width ≈ 0.55 × fontSize for monospace-ish labels
      const textContent = textEl.textContent || '';
      const estWidth = textContent.length * labelFontSize * 0.55;
      const estHeight = labelFontSize;

      // Get position from text element attributes
      const tx = parseFloat(textEl.getAttribute('x') || '0');
      const ty = parseFloat(textEl.getAttribute('y') || '0');
      const anchor = textEl.getAttribute('text-anchor') || 'middle';
      const transform = textEl.getAttribute('transform') || '';

      let rx = tx - estWidth / 2;
      if (anchor === 'start') rx = tx - haloPadX;
      else if (anchor === 'end') rx = tx - estWidth;
      else rx = tx - estWidth / 2;
      const ry = ty - estHeight + haloPadY;

      const halo = svgEl('rect', {
        x: rx - haloPadX,
        y: ry - haloPadY,
        width: estWidth + haloPadX * 2,
        height: estHeight + haloPadY * 2,
        fill: 'white',
        'fill-opacity': 0.8,
        rx: labelFontSize * 0.15,
        ry: labelFontSize * 0.15,
      });
      if (transform) halo.setAttribute('transform', transform);
      parent.appendChild(halo);
    }
    parent.appendChild(textEl);
  };

  // Clipped label group (inside labels must stay within the frame)
  const labelClipId = `grid-label-clip-${Date.now()}`;
  let labelsGroup: SVGElement;
  if (inside) {
    const labelClip = svgEl('clipPath', { id: labelClipId });
    labelClip.appendChild(svgEl('rect', {
      x: frame.x, y: frame.y, width: frame.width, height: frame.height,
    }));
    g.appendChild(labelClip);
    labelsGroup = svgEl('g', { 'clip-path': `url(#${labelClipId})` });
  } else {
    labelsGroup = svgEl('g');
  }

  // TOP & BOTTOM — longitude labels (horizontal text)
  for (const lng of meridians) {
    const x = lngToX(lng);
    const label = formatDMS(lng, false);

    if (inside) {
      // Top label — just inside the top edge
      const topLabel = svgText(x, frame.y + insetPad + labelFontSize, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      addLabelWithHalo(labelsGroup, topLabel);

      // Bottom label — just inside the bottom edge
      const botLabel = svgText(x, frame.y + frame.height - insetPad, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      addLabelWithHalo(labelsGroup, botLabel);
    } else {
      // Outside: ticks + labels outside the frame
      g.appendChild(svgEl('line', {
        x1: x, y1: frame.y - tickLen, x2: x, y2: frame.y,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
      g.appendChild(svgText(x, frame.y - tickLen - labelGap, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      }));

      g.appendChild(svgEl('line', {
        x1: x, y1: frame.y + frame.height, x2: x, y2: frame.y + frame.height + tickLen,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
      g.appendChild(svgText(x, frame.y + frame.height + tickLen + labelGap + labelFontSize, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      }));
    }
  }

  // LEFT & RIGHT — latitude labels (vertical / rotated text)
  for (const lat of parallels) {
    const y = latToY(lat);
    const label = formatDMS(lat, true);

    if (inside) {
      // Left label — just inside the left edge, rotated -90°
      const leftLabel = svgText(0, 0, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      leftLabel.setAttribute('transform', `translate(${frame.x + insetPad + labelFontSize},${y}) rotate(-90)`);
      addLabelWithHalo(labelsGroup, leftLabel);

      // Right label — just inside the right edge, rotated 90°
      const rightLabel = svgText(0, 0, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      rightLabel.setAttribute('transform', `translate(${frame.x + frame.width - insetPad - labelFontSize * 0.3},${y}) rotate(90)`);
      addLabelWithHalo(labelsGroup, rightLabel);
    } else {
      // Outside: ticks + labels outside the frame
      g.appendChild(svgEl('line', {
        x1: frame.x - tickLen, y1: y, x2: frame.x, y2: y,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
      const leftLabel = svgText(0, 0, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      leftLabel.setAttribute('transform', `translate(${frame.x - tickLen - labelGap},${y}) rotate(-90)`);
      g.appendChild(leftLabel);

      g.appendChild(svgEl('line', {
        x1: frame.x + frame.width, y1: y, x2: frame.x + frame.width + tickLen, y2: y,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
      const rightLabel = svgText(0, 0, label, {
        fontSize: labelFontSize, fontFamily: labelFont, fill: labelColor, anchor: 'middle',
      });
      rightLabel.setAttribute('transform', `translate(${frame.x + frame.width + tickLen + labelGap},${y}) rotate(90)`);
      g.appendChild(rightLabel);
    }
  }

  g.appendChild(labelsGroup);

  // Corner crosshair tick marks (only for outside placement)
  if (!inside) {
    const cornerTickLen = 1.5;
    const corners = [
      { x: frame.x, y: frame.y },
      { x: frame.x + frame.width, y: frame.y },
      { x: frame.x, y: frame.y + frame.height },
      { x: frame.x + frame.width, y: frame.y + frame.height },
    ];
    for (const c of corners) {
      const hDir = c.x === frame.x ? -1 : 1;
      g.appendChild(svgEl('line', {
        x1: c.x, y1: c.y, x2: c.x + hDir * cornerTickLen, y2: c.y,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
      const vDir = c.y === frame.y ? -1 : 1;
      g.appendChild(svgEl('line', {
        x1: c.x, y1: c.y, x2: c.x, y2: c.y + vDir * cornerTickLen,
        stroke: tickColor, 'stroke-width': tickWidth,
      }));
    }
  }

  return g;
}

/** Build a drawing annotation shape */
function buildDrawingShape(d: DrawingAnnotation): SVGElement {
  const g = svgEl('g', { 'data-drawing': d.id, ...(d.locked ? { 'data-locked': 'true' } : {}) });

  const commonStroke: Record<string, string | number> = {
    stroke: d.strokeColor,
    'stroke-width': d.strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };

  // For line/arrow types, add an invisible fat hit-area so the shape is easy to click/drag
  const addLineHitArea = (x1: number, y1: number, x2: number, y2: number) => {
    g.appendChild(svgEl('line', {
      x1, y1, x2, y2,
      stroke: 'transparent',
      'stroke-width': Math.max(d.strokeWidth * 6, 3),
      fill: 'none',
    }));
  };

  switch (d.type) {
    case 'line': {
      addLineHitArea(d.x1, d.y1, d.x2, d.y2);
      g.appendChild(svgEl('line', {
        x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
        fill: 'none',
        ...commonStroke,
      }));
      break;
    }

    case 'arrow': {
      addLineHitArea(d.x1, d.y1, d.x2, d.y2);
      // Shorten the line slightly so it doesn't poke through the arrowhead
      const angle = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
      const headLen = Math.max(d.strokeWidth * 5, 2.5);
      const lineEndX = d.x2 - headLen * 0.5 * Math.cos(angle);
      const lineEndY = d.y2 - headLen * 0.5 * Math.sin(angle);
      g.appendChild(svgEl('line', {
        x1: d.x1, y1: d.y1, x2: lineEndX, y2: lineEndY,
        fill: 'none',
        ...commonStroke,
      }));
      // Arrowhead triangle at (x2,y2)
      const a1 = angle + Math.PI * 0.82;
      const a2 = angle - Math.PI * 0.82;
      const px1 = d.x2 + headLen * Math.cos(a1);
      const py1 = d.y2 + headLen * Math.sin(a1);
      const px2 = d.x2 + headLen * Math.cos(a2);
      const py2 = d.y2 + headLen * Math.sin(a2);
      g.appendChild(svgEl('polygon', {
        points: `${d.x2},${d.y2} ${px1},${py1} ${px2},${py2}`,
        fill: d.strokeColor,
        stroke: d.strokeColor,
        'stroke-width': d.strokeWidth * 0.3,
        'stroke-linejoin': 'round',
      }));
      break;
    }

    case 'circle': {
      const cx = (d.x1 + d.x2) / 2;
      const cy = (d.y1 + d.y2) / 2;
      const rx = Math.abs(d.x2 - d.x1) / 2;
      const ry = Math.abs(d.y2 - d.y1) / 2;
      g.appendChild(svgEl('ellipse', {
        cx, cy, rx: Math.max(rx, 0.5), ry: Math.max(ry, 0.5),
        fill: d.fillColor,
        'fill-opacity': d.fillOpacity,
        ...commonStroke,
      }));
      break;
    }

    case 'point': {
      // Outer ring + filled inner for modern marker look
      g.appendChild(svgEl('circle', {
        cx: d.x1, cy: d.y1, r: 2,
        fill: d.strokeColor,
        'fill-opacity': 0.25,
        stroke: d.strokeColor,
        'stroke-width': 0.3,
      }));
      g.appendChild(svgEl('circle', {
        cx: d.x1, cy: d.y1, r: 0.8,
        fill: d.strokeColor,
        stroke: '#ffffff',
        'stroke-width': 0.2,
      }));
      break;
    }

    case 'rectangle': {
      const x = Math.min(d.x1, d.x2);
      const y = Math.min(d.y1, d.y2);
      const w = Math.abs(d.x2 - d.x1);
      const h = Math.abs(d.y2 - d.y1);
      g.appendChild(svgEl('rect', {
        x, y, width: Math.max(w, 0.5), height: Math.max(h, 0.5),
        fill: d.fillColor,
        'fill-opacity': d.fillOpacity,
        rx: 0.3,
        ...commonStroke,
      }));
      break;
    }
  }

  return g;
}

/** Build a logo / image annotation */
function buildImageAnnotation(img: ImageAnnotation): SVGElement {
  const g = svgEl('g', {
    'data-logo-image': img.id,
    transform: `translate(${img.position.x},${img.position.y})`,
    ...(img.locked ? { 'data-locked': 'true' } : {}),
  });

  const imageEl = svgEl('image', {
    width: img.widthMM,
    height: img.heightMM,
    opacity: img.opacity,
    preserveAspectRatio: 'xMidYMid meet',
  });
  imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', img.dataUrl);
  g.appendChild(imageEl);

  return g;
}

// ─── Watermark ────────────────────────────────────────────────────────

function buildWatermark(pageW: number, pageH: number, settings: WatermarkSettings): SVGElement {
  const g = svgEl('g', { class: 'watermark', 'pointer-events': 'none' });
  const textEl = svgText(pageW / 2, pageH / 2, settings.text, {
    fontSize: settings.fontSize,
    fontWeight: '700',
    fill: settings.color,
    anchor: 'middle',
  });
  textEl.setAttribute('opacity', String(settings.opacity));
  textEl.setAttribute('transform', `translate(${pageW / 2},${pageH / 2}) rotate(${settings.angle})`);
  textEl.setAttribute('x', '0');
  textEl.setAttribute('y', '0');
  g.appendChild(textEl);
  return g;
}

// ─── Crop & Bleed Marks ──────────────────────────────────────────────

function buildCropMarks(pageW: number, pageH: number): SVGElement {
  const g = svgEl('g', { class: 'crop-marks', 'pointer-events': 'none' });
  const markLen = 5; // 5mm lines
  const style: Record<string, string | number> = { stroke: '#000', 'stroke-width': 0.2 };

  // 4 corners × 2 lines each (horizontal + vertical)
  const corners = [
    { x: 0, y: 0, dx: -1, dy: -1 },
    { x: pageW, y: 0, dx: 1, dy: -1 },
    { x: 0, y: pageH, dx: -1, dy: 1 },
    { x: pageW, y: pageH, dx: 1, dy: 1 },
  ];
  for (const c of corners) {
    // Horizontal mark
    g.appendChild(svgEl('line', {
      x1: c.x + c.dx * 1, y1: c.y,
      x2: c.x + c.dx * (1 + markLen), y2: c.y,
      ...style,
    }));
    // Vertical mark
    g.appendChild(svgEl('line', {
      x1: c.x, y1: c.y + c.dy * 1,
      x2: c.x, y2: c.y + c.dy * (1 + markLen),
      ...style,
    }));
  }

  // Registration marks (small crosshairs at edge midpoints)
  const regSize = 1.5;
  const regPoints = [
    { x: pageW / 2, y: -3 },
    { x: pageW / 2, y: pageH + 3 },
    { x: -3, y: pageH / 2 },
    { x: pageW + 3, y: pageH / 2 },
  ];
  for (const p of regPoints) {
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: regSize, fill: 'none', stroke: '#000', 'stroke-width': 0.15 }));
    g.appendChild(svgEl('line', { x1: p.x - regSize, y1: p.y, x2: p.x + regSize, y2: p.y, ...style }));
    g.appendChild(svgEl('line', { x1: p.x, y1: p.y - regSize, x2: p.x, y2: p.y + regSize, ...style }));
  }

  return g;
}

// ─── Callout Annotations ─────────────────────────────────────────────

function buildCalloutAnnotation(ca: CalloutAnnotation): SVGElement {
  const g = svgEl('g', {
    'data-callout': ca.id,
    ...(ca.locked ? { 'data-locked': 'true' } : {}),
  });

  const target = ca.targetSVG!;
  const pos = ca.position;

  // Leader line from target to label position
  g.appendChild(svgEl('line', {
    x1: target.x, y1: target.y,
    x2: pos.x, y2: pos.y,
    stroke: ca.color, 'stroke-width': 0.3,
  }));

  // Background rect
  const textLen = ca.text.length * ca.fontSize * 0.55;
  const pad = 1;
  g.appendChild(svgEl('rect', {
    x: pos.x - pad,
    y: pos.y - ca.fontSize - pad,
    width: textLen + pad * 2,
    height: ca.fontSize + pad * 2,
    fill: ca.backgroundColor,
    rx: 0.5, ry: 0.5,
    opacity: 0.9,
  }));

  // Label text
  g.appendChild(svgText(pos.x, pos.y - 0.5, ca.text, {
    fontSize: ca.fontSize,
    fill: ca.color,
  }));

  // Target dot
  g.appendChild(svgEl('circle', {
    cx: target.x, cy: target.y, r: 0.8,
    fill: ca.color,
  }));

  return g;
}

// ─── Hatch Pattern Definitions ───────────────────────────────────────

function buildHatchPatternDefs(defs: SVGElement): void {
  const patterns: { id: string; content: string }[] = [
    { id: 'pattern-diagonal', content: '<line x1="0" y1="4" x2="4" y2="0" stroke="currentColor" stroke-width="0.5"/>' },
    { id: 'pattern-crosshatch', content: '<line x1="0" y1="4" x2="4" y2="0" stroke="currentColor" stroke-width="0.4"/><line x1="0" y1="0" x2="4" y2="4" stroke="currentColor" stroke-width="0.4"/>' },
    { id: 'pattern-horizontal', content: '<line x1="0" y1="2" x2="4" y2="2" stroke="currentColor" stroke-width="0.5"/>' },
    { id: 'pattern-vertical', content: '<line x1="2" y1="0" x2="2" y2="4" stroke="currentColor" stroke-width="0.5"/>' },
    { id: 'pattern-dots', content: '<circle cx="2" cy="2" r="0.6" fill="currentColor"/>' },
    { id: 'pattern-circles', content: '<circle cx="2" cy="2" r="1.2" fill="none" stroke="currentColor" stroke-width="0.3"/>' },
  ];

  for (const p of patterns) {
    const pat = svgEl('pattern', {
      id: p.id,
      width: 4, height: 4,
      patternUnits: 'userSpaceOnUse',
    });
    pat.innerHTML = p.content;
    defs.appendChild(pat);
  }
}

// ─── Scale Text Block ────────────────────────────────────────────────

function buildScaleTextBlock(
  x: number, y: number,
  scaleBar: ScaleBarInfo,
  pageLabel: string,
  fontSize: number
): SVGElement {
  const g = svgEl('g', {
    class: 'scale-text', 'data-element': 'scaleText',
    transform: `translate(${x},${y})`,
  });

  const rf = formatRepresentativeFraction(scaleBar.representativeFraction);
  const text = `Scale ${rf} at ${pageLabel}`;

  g.appendChild(svgText(0, 0, text, {
    fontSize,
    fill: '#333',
    anchor: 'start',
  }));

  return g;
}

// ─── Disclaimer / Data Sources Box ──────────────────────────────────

function buildDisclaimerBox(settings: DisclaimerBoxSettings): SVGElement {
  const g = svgEl('g', {
    class: 'disclaimer-box', 'data-element': 'disclaimerBox',
    transform: `translate(${settings.position.x},${settings.position.y})`,
  });

  const lines = settings.text.split('\n');
  const lineHeight = settings.fontSize * 1.4;
  const totalHeight = lines.length * lineHeight + settings.fontSize;
  const pad = 2;

  // Background rect
  g.appendChild(svgEl('rect', {
    x: -pad, y: -settings.fontSize - pad,
    width: settings.width + pad * 2,
    height: totalHeight + pad * 2,
    fill: settings.backgroundColor,
    stroke: settings.borderColor,
    'stroke-width': 0.2,
    rx: 0.5,
  }));

  // Wrapped text lines
  for (let i = 0; i < lines.length; i++) {
    // Word-wrap each line within width
    const words = lines[i].split(' ');
    let currentLine = '';
    let lineNum = i;
    const charWidth = settings.fontSize * 0.5;
    const maxChars = Math.floor(settings.width / charWidth);

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (test.length > maxChars && currentLine) {
        g.appendChild(svgText(0, lineNum * lineHeight, currentLine, {
          fontSize: settings.fontSize,
          fill: '#333',
        }));
        lineNum++;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      g.appendChild(svgText(0, lineNum * lineHeight, currentLine, {
        fontSize: settings.fontSize,
        fill: '#333',
      }));
    }
  }

  return g;
}

// ─── QR Code ─────────────────────────────────────────────────────────

function buildQRCode(pos: { x: number; y: number }, size: number, url: string): SVGElement {
  const g = svgEl('g', {
    class: 'qr-code', 'data-element': 'qrCode',
    transform: `translate(${pos.x},${pos.y})`,
  });

  try {
    const matrix = generateQRCode(url);
    const modSize = size / matrix.length;

    // White background
    g.appendChild(svgEl('rect', {
      x: -0.5, y: -0.5,
      width: size + 1, height: size + 1,
      fill: '#ffffff',
      stroke: '#cccccc',
      'stroke-width': 0.1,
    }));

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          g.appendChild(svgEl('rect', {
            x: c * modSize,
            y: r * modSize,
            width: modSize,
            height: modSize,
            fill: '#000000',
          }));
        }
      }
    }
  } catch {
    // Fallback: show placeholder
    g.appendChild(svgEl('rect', {
      x: 0, y: 0, width: size, height: size,
      fill: '#f0f0f0', stroke: '#ccc', 'stroke-width': 0.2,
    }));
    g.appendChild(svgText(size / 2, size / 2, 'QR', {
      fontSize: size * 0.3, anchor: 'middle', fill: '#999',
    }));
  }

  return g;
}

// ─── Overview Locator Map ────────────────────────────────────────────

function buildLocatorMap(pos: { x: number; y: number }, size: number, aoiBBox: BBox): SVGElement {
  const g = svgEl('g', {
    class: 'locator-map', 'data-element': 'locatorMap',
    transform: `translate(${pos.x},${pos.y})`,
  });

  const mapHeight = size * 0.5; // equirectangular aspect

  // Border
  g.appendChild(svgEl('rect', {
    x: 0, y: 0, width: size, height: mapHeight,
    fill: '#e8f0fe', stroke: '#666', 'stroke-width': 0.2,
  }));

  // World outline
  const worldPath = projectWorldToSVG(0, 0, size);
  const pathEl = svgEl('path', {
    d: worldPath,
    fill: '#d4d4d4',
    stroke: '#999',
    'stroke-width': 0.15,
  });
  // Clip to the map box
  g.appendChild(pathEl);

  // AOI indicator — red rectangle
  const aoiX = ((aoiBBox.west + 180) / 360) * size;
  const aoiY = ((90 - aoiBBox.north) / 180) * mapHeight;
  const aoiW = ((aoiBBox.east - aoiBBox.west) / 360) * size;
  const aoiH = ((aoiBBox.north - aoiBBox.south) / 180) * mapHeight;

  if (aoiW > 0.5 && aoiH > 0.5) {
    g.appendChild(svgEl('rect', {
      x: aoiX, y: aoiY,
      width: Math.max(aoiW, 1), height: Math.max(aoiH, 0.5),
      fill: 'rgba(220,38,38,0.3)',
      stroke: '#dc2626',
      'stroke-width': 0.3,
    }));
  } else {
    // Small area — show as dot
    const cx = aoiX + aoiW / 2;
    const cy = aoiY + aoiH / 2;
    g.appendChild(svgEl('circle', {
      cx, cy, r: 1,
      fill: '#dc2626',
      stroke: '#fff',
      'stroke-width': 0.2,
    }));
  }

  return g;
}

// ─── Symbol Marker ───────────────────────────────────────────────────

function buildSymbolMarker(sym: SymbolAnnotation): SVGElement {
  const g = svgEl('g', {
    'data-symbol': sym.id,
    ...(sym.locked ? { 'data-locked': 'true' } : {}),
  });

  const target = sym.targetSVG!;
  const symbolDef = getSymbolById(sym.symbolId);
  if (!symbolDef) return g;

  // Parse viewBox to get scale
  const vb = symbolDef.viewBox.split(' ').map(Number);
  const scale = sym.size / Math.max(vb[2], vb[3]);

  const iconG = svgEl('g', {
    transform: `translate(${target.x - sym.size / 2},${target.y - sym.size / 2}) scale(${scale})`,
  });
  const path = svgEl('path', {
    d: symbolDef.svgPath,
    fill: sym.color,
  });
  iconG.appendChild(path);
  g.appendChild(iconG);

  // Optional label
  if (sym.label) {
    g.appendChild(svgText(target.x, target.y + sym.size / 2 + 2, sym.label, {
      fontSize: 2,
      fill: sym.color,
      anchor: 'middle',
    }));
  }

  return g;
}

// ─── Data Table ──────────────────────────────────────────────────────

function buildDataTable(table: DataTableSettings): SVGElement {
  const g = svgEl('g', {
    class: 'data-table', 'data-element': 'dataTable',
    transform: `translate(${table.position.x},${table.position.y})`,
  });

  const numCols = table.headers.length;
  if (numCols === 0) return g;

  const colWidth = table.width / numCols;
  const rowHeight = table.fontSize * 2;
  const displayRows = table.rows.slice(0, table.maxRows);
  const totalHeight = (1 + displayRows.length) * rowHeight;

  // Outer border
  g.appendChild(svgEl('rect', {
    x: 0, y: 0,
    width: table.width, height: totalHeight,
    fill: 'none', stroke: table.borderColor, 'stroke-width': 0.2,
  }));

  // Header row
  g.appendChild(svgEl('rect', {
    x: 0, y: 0,
    width: table.width, height: rowHeight,
    fill: table.headerBg,
  }));

  for (let c = 0; c < numCols; c++) {
    const text = table.headers[c] || '';
    const truncated = text.length * table.fontSize * 0.5 > colWidth
      ? text.slice(0, Math.floor(colWidth / (table.fontSize * 0.5))) + '...'
      : text;
    g.appendChild(svgText(
      c * colWidth + colWidth / 2,
      rowHeight * 0.65,
      truncated,
      { fontSize: table.fontSize, fontWeight: '700', fill: table.headerColor, anchor: 'middle' }
    ));
    // Column separator
    if (c > 0) {
      g.appendChild(svgEl('line', {
        x1: c * colWidth, y1: 0,
        x2: c * colWidth, y2: totalHeight,
        stroke: table.borderColor, 'stroke-width': 0.1,
      }));
    }
  }

  // Data rows
  for (let r = 0; r < displayRows.length; r++) {
    const y = (r + 1) * rowHeight;

    // Alternating background
    if (r % 2 === 1) {
      g.appendChild(svgEl('rect', {
        x: 0, y,
        width: table.width, height: rowHeight,
        fill: table.cellBg,
        opacity: 0.3,
      }));
    }

    // Row separator
    g.appendChild(svgEl('line', {
      x1: 0, y1: y,
      x2: table.width, y2: y,
      stroke: table.borderColor, 'stroke-width': 0.08,
    }));

    for (let c = 0; c < numCols; c++) {
      const text = displayRows[r][c] || '';
      const truncated = text.length * table.fontSize * 0.5 > colWidth
        ? text.slice(0, Math.floor(colWidth / (table.fontSize * 0.5))) + '...'
        : text;
      g.appendChild(svgText(
        c * colWidth + colWidth / 2,
        y + rowHeight * 0.65,
        truncated,
        { fontSize: table.fontSize, fill: '#333', anchor: 'middle' }
      ));
    }
  }

  return g;
}

// ─── Atlas Page Label ────────────────────────────────────────────────

function buildAtlasPageLabel(
  x: number, y: number,
  pageNum: number, gridRef: string, totalPages: number
): SVGElement {
  const g = svgEl('g', { class: 'atlas-page-label', transform: `translate(${x},${y})` });
  g.appendChild(svgText(0, 0, `Page ${pageNum}/${totalPages} — Grid ${gridRef}`, {
    fontSize: 2.5,
    fontWeight: '600',
    fill: '#333',
    anchor: 'middle',
  }));
  return g;
}
