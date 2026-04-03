/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
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
    host: '0.0.0.0', // Listen on all network interfaces
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
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('/node_modules/@remix-run/router/')
          ) {
            return 'router-vendor';
          }

          if (
            id.includes('/node_modules/@tanstack/react-query/') ||
            id.includes('/node_modules/@tanstack/query-core/')
          ) {
            return 'query-vendor';
          }

          if (
            id.includes('/node_modules/socket.io-client/') ||
            id.includes('/node_modules/engine.io-client/') ||
            id.includes('/node_modules/socket.io-parser/') ||
            id.includes('/node_modules/engine.io-parser/') ||
            id.includes('/node_modules/@socket.io/')
          ) {
            return 'socket-vendor';
          }

          if (id.includes('/node_modules/framer-motion/')) {
            return 'animation-vendor';
          }

          return undefined;
        },
      },
    },
  },
});
