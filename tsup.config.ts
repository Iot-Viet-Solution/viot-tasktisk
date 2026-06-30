import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node20',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  noExternal: [],
  define: {
    // Injected at build time so the binary knows its own version without reading package.json at runtime
    __PKG_VERSION__: JSON.stringify(version),
  },
});
