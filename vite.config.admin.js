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
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
        manualChunks(id) {
          const featureVendorGroups = [
            {
              name: 'vendor-backup',
              patterns: [
                /webroot[\\/]+admin[\\/]+js[\\/]+modules[\\/]+backup\.js$/,
                /webroot[\\/]+admin[\\/]+js[\\/]+modules[\\/]+system_cleanup\.js$/
              ]
            },
            {
              name: 'vendor-users',
              patterns: [
                /webroot[\\/]+admin[\\/]+js[\\/]+modules[\\/]+user_admin\.js$/,
                /webroot[\\/]+admin[\\/]+js[\\/]+core[\\/]+auth_service\.js$/,
                /webroot[\\/]+admin[\\/]+js[\\/]+app[\\/]+lazy_modules\.js$/
              ]
            }
          ];

          const matchedFeature = featureVendorGroups.find((group) =>
            group.patterns.some((pattern) => pattern.test(id))
          );
          if (matchedFeature) {
            return matchedFeature.name;
          }

          if (id.includes('node_modules')) {
            return 'vendor-core';
          }
        }
      }
    }
  },
  esbuild: {
    target: 'es2019'
  }
});
