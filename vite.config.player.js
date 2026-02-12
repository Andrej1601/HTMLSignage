import { defineConfig } from 'vite';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  root: projectRoot,
  base: '/player/dist/',
  build: {
    outDir: path.resolve(projectRoot, 'webroot/player/dist'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    sourcemap: true,
    rollupOptions: {
      input: {
        player: path.resolve(projectRoot, 'webroot/player/src/main.js')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  esbuild: {
    target: 'es2019'
  }
});
