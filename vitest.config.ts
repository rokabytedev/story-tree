import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const uiSrc = resolve(rootDir, 'apps/story-tree-ui/src');
const serverOnlyShim = resolve(rootDir, 'apps/story-tree-ui/src/server/server-only-shim.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@': uiSrc,
      'server-only': serverOnlyShim,
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: [
      'agent-backend/test/**/*.test.ts',
      'supabase/test/**/*.test.ts',
      'apps/story-tree-ui/src/**/*.test.ts',
      'apps/story-tree-ui/src/**/*.test.tsx',
    ],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'jsdom',
    setupFiles: ['apps/story-tree-ui/src/test/setupTests.ts'],
  },
});
