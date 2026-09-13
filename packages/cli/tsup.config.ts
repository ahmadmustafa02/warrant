import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const repoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '../..');

export default defineConfig({
  entry: { warrant: '../../src/scripts/warrant-cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  shims: true,
  esbuildOptions(options) {
    options.alias = {
      '@': path.join(repoRoot, 'src'),
    };
  },
});
