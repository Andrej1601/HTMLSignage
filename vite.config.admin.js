import { defineConfig } from 'vite';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  root: projectRoot,
  base: '/admin/dist/',
  build: {
    outDir: path.resolve(projectRoot, 'webroot/admin/dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        admin: path.resolve(projectRoot, 'webroot/admin/js/app.js')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  esbuild: {
    target: 'es2019'
  }
});
