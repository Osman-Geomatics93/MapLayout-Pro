/**
 * Zip the dist/ folder into maplayout-pro.zip for Chrome Web Store upload.
 * Uses the project's existing jszip dependency — no extra installs needed.
 *
 * Usage: node scripts/package.mjs  (called automatically by `npm run package`)
 */

import JSZip from 'jszip';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf-8'));
const version = manifest.version;
const outFile = join(__dirname, '..', `MapLayout-Pro-v${version}.zip`);

function addDir(zip, dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      addDir(zip, full);
    } else {
      const rel = relative(distDir, full).replace(/\\/g, '/');
      zip.file(rel, readFileSync(full));
    }
  }
}

const zip = new JSZip();
addDir(zip, distDir);

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(outFile, buf);
console.log(`✓ ${outFile} (${(buf.length / 1024).toFixed(1)} KB)`);
