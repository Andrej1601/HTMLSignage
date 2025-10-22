import { defineConfig } from 'vite';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  root: projectRoot,
  base: '/player/dist/',
  build: {
    outDir: path.resolve(projectRoot, 'webroot/player/dist'),
    emptyOutDir: true,
    sourcemap: true,
    // Downlevel modern syntax like optional chaining for the player WebViews
    // (they still run a Chrome 69 equivalent without native support).
    target: 'es2018',
    rollupOptions: {
      input: {
        player: path.resolve(projectRoot, 'webroot/player/src/main.js')
      },
      output: {
        entryFileNames: 'slideshow.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
