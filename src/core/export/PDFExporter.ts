/**
 * PDF Exporter — Converts layout SVG to a vector PDF.
 *
 * Uses jsPDF + svg2pdf.js for hybrid output:
 * - Text, lines, scale bars, north arrows → vector (crisp at any zoom)
 * - Map frame images → raster (embedded at rendered DPI)
 *
 * This produces searchable, print-quality PDFs.
 */

import { jsPDF } from 'jspdf';
// svg2pdf.js auto-registers as a jsPDF plugin when imported
import 'svg2pdf.js';

export interface GeoPDFMetadata {
  bbox: { west: number; south: number; east: number; north: number };
  crs: string;
  epsg: number;
  scale: number;
  projection: string;
}

export interface PDFExportOptions {
  pageWidthMM: number;
  pageHeightMM: number;
  orientation: 'landscape' | 'portrait';
  dpi: number;
  title?: string;
  author?: string;
  subject?: string;
  manifestJSON?: string;
  geoMetadata?: GeoPDFMetadata;
  onProgress?: (pct: number, msg: string) => void;
}

/**
 * Export the layout SVG to a PDF blob.
 */
export async function exportToPDF(
  svgElement: SVGSVGElement,
  options: PDFExportOptions
): Promise<Blob> {
  const {
    pageWidthMM,
    pageHeightMM,
    orientation,
    title,
    author,
    subject,
    manifestJSON,
    onProgress,
  } = options;

  onProgress?.(10, 'Initializing PDF...');

  // Determine jsPDF format
  const format: [number, number] = [pageWidthMM, pageHeightMM];

  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format,
    compress: true,
  });

  // Set PDF metadata (including GeoPDF if available)
  const geoMeta = options.geoMetadata;
  const keywords = geoMeta
    ? `map, layout, cartography, GIS, GeoExtent:${geoMeta.bbox.west},${geoMeta.bbox.south},${geoMeta.bbox.east},${geoMeta.bbox.north}, CRS:EPSG:${geoMeta.epsg}, Scale:1:${geoMeta.scale}, Projection:${geoMeta.projection}`
    : 'map, layout, cartography, GIS';

  doc.setProperties({
    title: title || 'MapLayout Pro Export',
    author: author || 'MapLayout Pro',
    subject: subject || 'Cartographic map layout',
    creator: 'MapLayout Pro v1.4.0',
    keywords,
  });

  onProgress?.(30, 'Rendering SVG to PDF...');

  // Clone SVG to set correct dimensions for pdf rendering
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('width', `${pageWidthMM}mm`);
  svgClone.setAttribute('height', `${pageHeightMM}mm`);

  // Temporarily add to DOM (svg2pdf.js needs it in the document)
  svgClone.style.position = 'absolute';
  svgClone.style.left = '-9999px';
  svgClone.style.top = '-9999px';
  document.body.appendChild(svgClone);

  try {
    // Use svg2pdf.js to render the SVG into the PDF
    // The library is registered as a jsPDF plugin via the import
    await (doc as any).svg(svgClone, {
      x: 0,
      y: 0,
      width: pageWidthMM,
      height: pageHeightMM,
    });
  } finally {
    document.body.removeChild(svgClone);
  }

  onProgress?.(80, 'Embedding metadata...');

  // Embed layout manifest as custom metadata (if provided)
  if (manifestJSON) {
    doc.setFontSize(1);
    doc.setTextColor(255, 255, 255); // invisible white text
    doc.text(`MAPLAYOUT_MANIFEST:${manifestJSON}`, 1, 1);
  }

  // Embed GeoPDF metadata (if AOI exists)
  if (geoMeta) {
    doc.setFontSize(1);
    doc.setTextColor(255, 255, 255);
    const geoJSON = JSON.stringify({
      type: 'GeoPDF',
      bbox: geoMeta.bbox,
      crs: `EPSG:${geoMeta.epsg}`,
      scale: geoMeta.scale,
      projection: geoMeta.projection,
    });
    doc.text(`GEOPDF_METADATA:${geoJSON}`, 1, 2);
  }

  onProgress?.(95, 'Finalizing PDF...');

  // Generate blob
  const pdfBlob = doc.output('blob');

  onProgress?.(100, 'Done');

  return pdfBlob;
}

/**
 * Export multi-page atlas PDF from an array of SVG pages.
 */
export async function exportAtlasPDF(
  pages: SVGSVGElement[],
  options: PDFExportOptions
): Promise<Blob> {
  const { pageWidthMM, pageHeightMM, orientation, title, author, onProgress } = options;

  onProgress?.(5, 'Initializing atlas PDF...');

  const format: [number, number] = [pageWidthMM, pageHeightMM];
  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format,
    compress: true,
  });

  doc.setProperties({
    title: title || 'MapLayout Pro Atlas Export',
    author: author || 'MapLayout Pro',
    subject: 'Map atlas / series',
    creator: 'MapLayout Pro v1.4.0',
  });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage(format, orientation === 'landscape' ? 'l' : 'p');

    const pct = 10 + (80 * i) / pages.length;
    onProgress?.(pct, `Rendering page ${i + 1}/${pages.length}...`);

    const svgClone = pages[i].cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', `${pageWidthMM}mm`);
    svgClone.setAttribute('height', `${pageHeightMM}mm`);
    svgClone.style.position = 'absolute';
    svgClone.style.left = '-9999px';
    svgClone.style.top = '-9999px';
    document.body.appendChild(svgClone);

    try {
      await (doc as any).svg(svgClone, { x: 0, y: 0, width: pageWidthMM, height: pageHeightMM });
    } finally {
      document.body.removeChild(svgClone);
    }
  }

  onProgress?.(95, 'Finalizing atlas PDF...');
  const pdfBlob = doc.output('blob');
  onProgress?.(100, 'Done');
  return pdfBlob;
}

/**
 * Export the layout SVG as a standalone SVG file.
 */
export function exportToSVG(svgElement: SVGSVGElement): Blob {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
  return new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
}
