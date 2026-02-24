import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

/**
 * Strip remotely-hosted code references from jspdf.
 * jspdf's "pdfobjectnewwindow" output mode hardcodes a CDN <script> tag
 * for PDFObject. We never use that mode (only `output('blob')`), but
 * Chrome Web Store's MV3 static analysis flags the URL string.
 * This plugin neutralizes it at build time.
 */
function stripRemoteCodeFromJsPDF(): Plugin {
  return {
    name: 'strip-jspdf-remote-code',
    transform(code, id) {
      if (!id.includes('jspdf')) return;
      // Replace the CDN URL so no remote script reference appears in the bundle
      const stripped = code.replace(
        'https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js',
        ''
      );
      if (stripped !== code) return stripped;
    },
  };
}

const isFirefox = process.env.BROWSER === 'firefox';

export default defineConfig({
  plugins: [stripRemoteCodeFromJsPDF()],
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@data': resolve(__dirname, 'data'),
    },
  },
  build: {
    outDir: isFirefox ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/popup.html'),
        designer: resolve(__dirname, 'src/ui/designer/designer.html'),
        'service-worker': resolve(__dirname, 'src/bg/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'bg/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  publicDir: 'public',
  experimental: {
    // Rewrite asset URLs in HTML to be relative to the HTML file's location
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'html') {
        // HTML files are at dist/src/ui/{popup,designer}/*.html
        // Assets are at dist/assets/*
        // So relative path from HTML → assets is ../../../assets/
        return '../../../' + filename;
      }
      return filename;
    },
  },
});
