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

export interface PDFExportOptions {
  pageWidthMM: number;
  pageHeightMM: number;
  orientation: 'landscape' | 'portrait';
  dpi: number;
  title?: string;
  author?: string;
  subject?: string;
  manifestJSON?: string;
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

  // Set PDF metadata
  doc.setProperties({
    title: title || 'MapLayout Pro Export',
    author: author || 'MapLayout Pro',
    subject: subject || 'Cartographic map layout',
    creator: 'MapLayout Pro v0.1.0',
    keywords: 'map, layout, cartography, GIS',
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
    // Add as a hidden text annotation (accessible in PDF readers)
    // This is a pragmatic approach; full XMP metadata requires more complex handling
    doc.setFontSize(1);
    doc.setTextColor(255, 255, 255); // invisible white text
    doc.text(`MAPLAYOUT_MANIFEST:${manifestJSON}`, 1, 1);
  }

  onProgress?.(95, 'Finalizing PDF...');

  // Generate blob
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
