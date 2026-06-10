import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // HTML snapshot fidelity doesn't benefit from concurrency here and
    // sequential output is nicer to read when a baseline breaks.
    sequence: { concurrent: false },
  },
});
