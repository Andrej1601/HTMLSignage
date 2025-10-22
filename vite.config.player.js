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
  },
  esbuild: {
    target: 'es2019'
  }
});
