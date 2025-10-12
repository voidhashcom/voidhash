import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['./**/*.test.ts'],
    exclude: ['./lib/api/v1/**/*.test.ts', './node_modules/**'],
    reporters: ['verbose'],
    env: loadEnv('', process.cwd(), '')
  }
});
