import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      // TODO: Re-enable this when we release the API
      // "./lib/api/v1/**/*.test.ts",
      './lib/services/**/*.integration.test.ts',
      './lib/payment-providers/**/*.integration.test.ts'
    ],
    reporters: ['verbose'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 60_000,
    teardownTimeout: 60_000
  }
});
