import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pdfjsAssets } from './scripts/vite-pdfjs-assets.mjs';

export default defineConfig({
  // pdfjsAssets: PDF.js fonts, character maps and decoders, served locally under /pdfjs/.
  plugins: [react(), tailwindcss(), pdfjsAssets()],
  server: { port: 5173 },
  // The app bundle (React, Motion, Dexie) is ~620 kB; PDF.js is loaded on demand in its own chunk.
  build: { chunkSizeWarningLimit: 800 },
});
