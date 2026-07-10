import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    server: {
      // @stellar/freighter-api (pulled in by stellar-wallets-kit) ships as
      // CJS; without inlining it, Vite treats it as external and its named
      // exports don't interop cleanly under Vitest's ESM loader.
      deps: {
        inline: [/@creit\.tech\/stellar-wallets-kit/, /@stellar\/freighter-api/],
      },
    },
  },
});
