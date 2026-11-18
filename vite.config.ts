import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createApiApp } from './server/api.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vyapar-taxone-api-server',
      configureServer(server) {
        const apiApp = createApiApp();
        server.middlewares.use(apiApp);
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
