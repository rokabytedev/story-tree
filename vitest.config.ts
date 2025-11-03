import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const uiSrc = resolve(fileURLToPath(new URL('.', import.meta.url)), 'apps/story-tree-ui/src');

export default defineConfig({
  resolve: {
    alias: {
      '@': uiSrc,
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
    setupFiles: ['apps/story-tree-ui/src/test/setupTests.ts'],
  },
});
