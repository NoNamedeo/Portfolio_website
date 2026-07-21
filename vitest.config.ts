import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': source + '/core',
      '@application': source + '/core/application',
      '@infrastructure': source + '/infrastructure',
      '@app': source + '/app'
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] }
  }
});
