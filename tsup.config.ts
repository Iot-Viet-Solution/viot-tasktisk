import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node20',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // node_modules are external — npm handles them at install time
  noExternal: [],
});
