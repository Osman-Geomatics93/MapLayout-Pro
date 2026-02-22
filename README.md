# MapLayout Pro — Browser Extension

Professional cartographic map layouts from your browser. No desktop GIS required.

## Quick Start

### Prerequisites
- Node.js 18+ and npm (or pnpm/yarn)

### Install & Build

```bash
cd extension
npm install
npm run build
```

### Load in Chrome (Development)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

### Load in Firefox (Development)

```bash
npm run build:firefox
```

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/dist-firefox/manifest.json`

### Development Mode (watch)

```bash
npm run dev
```

This rebuilds on file changes. Reload the extension in the browser after changes.

## Usage

1. Click the extension icon → **Open Layout Designer**
2. Click a country on the map (or search by name)
3. The layout preview appears with: title, scale bar, north arrow, CRS block, inset maps
4. Edit the title, author, and date in the left panel
5. Click **Export** → choose PDF / PNG / SVG at 300 DPI
6. Done — you have a publication-ready map layout

## Architecture

```
extension/
├── public/manifest.json     # Manifest V3
├── src/
│   ├── ui/popup/            # Extension popup (quick search)
│   ├── ui/designer/         # Full-tab layout designer (main UI)
│   ├── bg/                  # Service worker
│   ├── core/
│   │   ├── geo/             # Projections, scale bar, graticule, geocoding
│   │   ├── layout/          # SVG layout engine
│   │   ├── export/          # PNG/PDF/SVG exporters
│   │   ├── data/            # Boundary loader + cache
│   │   └── types/           # TypeScript type definitions
│   ├── assets/              # North arrows, icons
│   └── templates/           # Layout template JSON files
```

## Tech Stack

| Component | Library |
|-----------|---------|
| Map | MapLibre GL JS 4.x |
| Layout | Custom SVG DOM compositor |
| PDF | jsPDF + svg2pdf.js |
| Projections | proj4js |
| Spatial ops | turf.js (modular) |
| Boundaries | Natural Earth (public domain) |
| Build | Vite + TypeScript |

## License

MIT
