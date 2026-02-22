import { defineConfig } from 'vite';
import { resolve } from 'path';

const isFirefox = process.env.BROWSER === 'firefox';

export default defineConfig({
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
