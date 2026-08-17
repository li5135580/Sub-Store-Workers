import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { createDashboardBuildParts } from './vite.shared.config.js';

const dashboard = createDashboardBuildParts();

export default defineConfig({
  plugins: [
    ...(dashboard.plugins || []),
    cloudflare(),
  ],
  resolve: dashboard.resolve || {},
  optimizeDeps: dashboard.optimizeDeps || {},
  build: {
    assetsDir: dashboard.assetsDir || 'assets',
    rollupOptions: {
      input: dashboard.input || {},
      external: dashboard.external || [],
    },
  },
  server: {
    strictPort: true,
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      credentials: true,
    },
  },
});
