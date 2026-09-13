import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Core logic is framework-agnostic and runs in a plain Node environment.
 * Coverage thresholds are enforced in CI so the security-critical modules
 * cannot silently lose test coverage.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/core/**/*.ts',
        'src/eval/**/*.ts',
        'src/lib/**/*.ts',
        'src/adapters/proxy/**/*.ts',
        'src/agent/intent/**/*.ts',
        'src/agent/guard/**/*.ts',
        'src/eval/classifyOutcome.ts',
        'src/eval/metrics.ts',
        'src/lib/format.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        '**/types.ts',
        'src/eval/payloads/documentInjectionAuthored.ts',
        'src/lib/playgroundPresets.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
