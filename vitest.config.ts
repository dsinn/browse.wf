import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/typestripped/**', '**/dist/**'],
  },
});
