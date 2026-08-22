// Learn more https://docs.expo.dev/guides/monorepos
// oxlint-disable-next-line effect/noDynamicImports -- Metro loads this config file itself as CommonJS; it must stay a require()-based .js module and never runs inside an Effect runtime.
const { getDefaultConfig } = require("expo/metro-config");
// oxlint-disable-next-line effect/noDynamicImports -- Metro loads this config file itself as CommonJS; it must stay a require()-based .js module and never runs inside an Effect runtime.
const { FileStore } = require("metro-cache");
// oxlint-disable-next-line effect/noDynamicImports -- Metro loads this config file itself as CommonJS; it must stay a require()-based .js module and never runs inside an Effect runtime.
const path = require("node:path");

// Create the default Expo config for Metro
// This includes the automatic monorepo configuration for workspaces
// See: https://docs.expo.dev/guides/monorepos/#automatic-configuration
const config = getDefaultConfig(__dirname);

// Use turborepo to restore the cache when possible
config.cacheStores = [
  new FileStore({
    root: path.join(__dirname, "node_modules", ".cache", "metro"),
  }),
];

module.exports = config;
