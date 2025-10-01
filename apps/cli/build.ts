import * as esbuild from 'esbuild';
import * as tsup from 'tsup';
import pkg from './package.json' with { type: 'json' };

esbuild.buildSync({
  entryPoints: ['./src/cli/index.ts'],
  bundle: true,
  outfile: 'dist/bin.cjs',
  format: 'cjs',
  target: 'node16',
  platform: 'node',
  define: {
    'process.env.VOIDHASH_CLI_VERSION': `"${pkg.version}"`
  },
  external: ['esbuild'],
  banner: {
    js: '#!/usr/bin/env node'
  }
});

const main = async () => {
  await tsup.build({
    entryPoints: ['./src/index.ts'],
    outDir: './dist',
    external: ['esbuild'],
    splitting: false,
    dts: true,
    format: ['cjs', 'esm'],
    outExtension: (ctx) => {
      if (ctx.format === 'cjs') {
        return {
          dts: '.d.ts',
          js: '.js'
        };
      }
      return {
        dts: '.d.mts',
        js: '.mjs'
      };
    }
  });
};

main().catch((e) => {
  // biome-ignore lint/suspicious/noConsole: User facing console error.
  console.error(e);
  process.exit(1);
});
