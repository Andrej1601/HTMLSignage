/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
  server: {
    host: process.env.VITE_DEV_HOST || 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    emptyOutDir: true,
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /\/node_modules\/(?:react|react-dom|scheduler)\// },
            { name: 'router-vendor', test: /\/node_modules\/(?:react-router(?:-dom)?|@remix-run\/router)\// },
            { name: 'query-vendor', test: /\/node_modules\/@tanstack\/(?:react-)?query(?:-core)?\// },
            { name: 'socket-vendor', test: /\/node_modules\/(?:socket\.io(?:-client)?|engine\.io(?:-client|-parser)?|@socket\.io)\// },
            { name: 'animation-vendor', test: /\/node_modules\/framer-motion\// },
          ],
        },
      },
    },
  },
});
