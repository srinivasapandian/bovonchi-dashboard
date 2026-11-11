import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The product-catalog code ported from Maghil-Merchant-Portal reads
 * `process.env.REACT_APP_*` (CRA). Rather than rewriting ~170 files we map our
 * `VITE_*` variables onto those names at build time.
 */
const ENV_MAP: Record<string, string> = {
  REACT_APP_API_ENDPOINT: 'VITE_API_ENDPOINT',
  REACT_APP_API_ENDPOINT_REVAMP: 'VITE_API_ENDPOINT_REVAMP',
  REACT_APP_E_KEY: 'VITE_E_KEY',
  REACT_APP_IMAGE_URL: 'VITE_IMAGE_URL',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const define: Record<string, string> = {};
  for (const [cra, vite] of Object.entries(ENV_MAP)) {
    define[`process.env.${cra}`] = JSON.stringify(env[vite] ?? '');
  }

  return {
    plugins: [react()],
    define,
    resolve: {
      alias: {
        // Web-only stand-ins for the Capacitor plugins the portal code imports.
        'capacitor-secure-storage-plugin': path.resolve(__dirname, 'src/shims/secureStorage.ts'),
        '@capacitor/core': path.resolve(__dirname, 'src/shims/capacitor.ts'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },
  };
});
