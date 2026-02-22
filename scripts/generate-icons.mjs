/**
 * Generate PNG icons for Chrome Web Store publishing.
 * Zero external dependencies — uses only Node built-in `zlib` + `fs`.
 *
 * Design matches scripts/generate-icons.html:
 *   blue rounded-rect background, white map frame, light-blue inset,
 *   white scale bar, white "M" letter.
 *
 * Usage:  node scripts/generate-icons.mjs
 * Output: public/icons/icon-{16,48,128}.png
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// Simple "M" glyph bitmap (7 columns × 9 rows)
const M_BITMAP = [
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
];

// ── Pixel drawing ────────────────────────────────────────────────

function createIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const cornerR = size * 0.1;
  const margin = Math.round(size * 0.15);

  const blue      = [0x25, 0x63, 0xEB, 0xFF];
  const white     = [0xFF, 0xFF, 0xFF, 0xFF];
  const lightBlue = [0xDB, 0xEA, 0xFE, 0xFF];

  function setPixel(x, y, color) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i]     = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }

  function inRoundedRect(x, y) {
    if (x < cornerR && y < cornerR)
      return Math.hypot(x - cornerR, y - cornerR) <= cornerR;
    if (x >= size - cornerR && y < cornerR)
      return Math.hypot(x - (size - cornerR - 1), y - cornerR) <= cornerR;
    if (x < cornerR && y >= size - cornerR)
      return Math.hypot(x - cornerR, y - (size - cornerR - 1)) <= cornerR;
    if (x >= size - cornerR && y >= size - cornerR)
      return Math.hypot(x - (size - cornerR - 1), y - (size - cornerR - 1)) <= cornerR;
    return true;
  }

  // 1. Blue background with rounded corners
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (inRoundedRect(x, y)) setPixel(x, y, blue);

  // 2. White map frame
  const fw = Math.round(size * 0.5);
  const fh = Math.round(size * 0.45);
  for (let y = margin; y < margin + fh; y++)
    for (let x = margin; x < margin + fw; x++)
      setPixel(x, y, white);

  // 3. Light-blue inset box
  const ix = Math.round(size * 0.68);
  const iw = Math.round(size * 0.18);
  const ih = Math.round(size * 0.18);
  for (let y = margin; y < margin + ih; y++)
    for (let x = ix; x < ix + iw; x++)
      setPixel(x, y, lightBlue);

  // 4. White scale bar
  const barY = Math.round(size - margin - size * 0.05);
  const barH = Math.max(1, Math.round(size * 0.04));
  for (let t = 0; t < barH; t++)
    for (let x = margin; x <= Math.round(size * 0.5); x++)
      setPixel(x, barY + t, white);

  // 5. "M" letter
  const fontSize = Math.round(size * 0.3);
  const cols = M_BITMAP[0].length;
  const rows = M_BITMAP.length;
  const cellW = Math.max(1, Math.round(fontSize / cols));
  const cellH = Math.max(1, Math.round(fontSize / rows));
  const totalW = cols * cellW;
  const totalH = rows * cellH;
  const mx = Math.round(size * 0.5 - totalW / 2);
  const my = Math.round(size * 0.82 - totalH);

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (M_BITMAP[r][c])
        for (let dy = 0; dy < cellH; dy++)
          for (let dx = 0; dx < cellW; dx++)
            setPixel(mx + c * cellW + dx, my + r * cellH + dy, white);

  return pixels;
}

// ── PNG encoder ──────────────────────────────────────────────────

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++)
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function encodePNG(w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  // compression, filter, interlace all 0

  // Raw scanlines: each row = 1 filter byte + w*4 pixel bytes
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4);
    raw[off] = 0; // filter: None
    pixels.copy
      ? Buffer.from(pixels.buffer, pixels.byteOffset + y * w * 4, w * 4).copy(raw, off + 1)
      : raw.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), off + 1);
  }

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(Buffer.from(raw))),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────

for (const size of [16, 48, 128]) {
  const pixels = createIcon(size);
  const png = encodePNG(size, size, pixels);
  const out = join(outDir, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ ${out} (${png.length} bytes)`);
}
console.log('Done — icons generated.');
