/**
 * PNG Exporter — Renders the layout SVG to a high-DPI PNG.
 *
 * Process:
 * 1. Serialize SVG to string
 * 2. Create an Image from the SVG data URL
 * 3. Draw onto a canvas at target DPI scale
 * 4. Export canvas as PNG blob
 */

export interface PNGExportOptions {
  dpi: number;
  pageWidthMM: number;
  pageHeightMM: number;
  onProgress?: (pct: number, msg: string) => void;
}

/**
 * Export an SVG element to a PNG blob at the specified DPI.
 */
export async function exportToPNG(
  svgElement: SVGSVGElement,
  options: PNGExportOptions
): Promise<Blob> {
  const { dpi, pageWidthMM, pageHeightMM, onProgress } = options;

  onProgress?.(10, 'Serializing layout...');

  // Target pixel dimensions
  const scaleFactor = dpi / 25.4; // pixels per mm
  const canvasWidth = Math.round(pageWidthMM * scaleFactor);
  const canvasHeight = Math.round(pageHeightMM * scaleFactor);

  // Clone SVG to avoid mutating the preview
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('width', `${canvasWidth}`);
  svgClone.setAttribute('height', `${canvasHeight}`);

  // Serialize to string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);
  const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  onProgress?.(30, 'Rendering at target DPI...');

  // Create image from SVG
  const img = await loadImage(dataUrl);

  onProgress?.(70, 'Compositing...');

  // Draw onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw SVG image
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  onProgress?.(90, 'Encoding PNG...');

  // Export as PNG blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onProgress?.(100, 'Done');
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/** Helper: load an image from a data URL */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Image load failed: ${e}`));
    img.src = src;
  });
}

/**
 * Trigger a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
