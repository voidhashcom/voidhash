/**
 * Size budgets of the published build, enforced by `pnpm test`. Each budget
 * counts what a page that uses the SDK downloads: the SDK and the parts of
 * `effect` it uses, minified and gzipped. size-limit leaves peer dependencies
 * out by default, so `effect` is put back in; React is the page's own.
 */
const countEffect = (config) => ({
  ...config,
  external: ["react", "react-dom", "react/jsx-runtime"],
});

export default [
  {
    name: "core: createVoidhashClient and capture, effect included",
    path: "dist/index.mjs",
    import: "{ createVoidhashClient }",
    gzip: true,
    limit: "47.8 kB",
    modifyEsbuildConfig: countEffect,
  },
  {
    name: "react: the provider and hooks, with core",
    path: ["dist/index.mjs", "dist/react.mjs"],
    import: {
      "dist/index.mjs": "{ createVoidhashClient }",
      "dist/react.mjs": "{ VoidhashProvider, useAnalytics, useFeatureFlags, useVoidhash }",
    },
    gzip: true,
    limit: "49.6 kB",
    modifyEsbuildConfig: countEffect,
  },
  {
    name: "script tag: voidhash.global.js, effect included",
    path: "dist/voidhash.global.js",
    gzip: true,
    limit: "48.6 kB",
  },
];
