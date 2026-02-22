import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'web'),
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@data': resolve(__dirname, 'data'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  },
  publicDir: false,
  server: {
    fs: {
      allow: [resolve(__dirname)],
    },
  },
});
