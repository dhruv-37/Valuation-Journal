import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

/**
 * PDF.js loads font data, character maps, ICC profiles and image decoders (wasm)
 * at runtime. This Vite plugin serves them from node_modules in dev and copies
 * them into the build under /pdfjs/, so every PDF renders fully offline and the
 * files always match the installed library version.
 */
export function pdfjsAssets() {
  const root = join(process.cwd(), 'node_modules', 'pdfjs-dist');
  const folders = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  return {
    name: 'vj-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs/', (req, res, next) => {
        const path = normalize(decodeURIComponent((req.url ?? '').split('?')[0])).replace(/^[\\/]+/, '');
        const folder = path.split(/[\\/]/)[0];
        const file = join(root, path);
        if (!folders.includes(folder) || !file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const folder of folders) {
        for (const name of readdirSync(join(root, folder))) {
          this.emitFile({ type: 'asset', fileName: `pdfjs/${folder}/${name}`, source: readFileSync(join(root, folder, name)) });
        }
      }
    },
  };
}
