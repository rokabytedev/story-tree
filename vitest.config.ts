import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['agent-backend/test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
