import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const repoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '../..');

export default defineConfig({
  entry: ['src/index.ts', 'src/agent.ts'],
  format: ['esm', 'cjs'],
  dts: { tsconfig: './tsconfig.json' },
  splitting: false,
  sourcemap: true,
  clean: true,
  esbuildOptions(options) {
    options.alias = {
      '@': path.join(repoRoot, 'src'),
    };
  },
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
