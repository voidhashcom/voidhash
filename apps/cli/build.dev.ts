import * as esbuild from 'esbuild';

esbuild.buildSync({
  entryPoints: ['./src/cli/index.ts'],
  bundle: true,
  outfile: 'dist/index.cjs',
  format: 'cjs',
  target: 'node16',
  platform: 'node',
  external: ['esbuild'],
  banner: {
    js: '#!/usr/bin/env -S node --loader ./dist/loader.mjs --no-warnings'
  }
});
