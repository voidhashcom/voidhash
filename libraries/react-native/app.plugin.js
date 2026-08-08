// const { withPlugins } = require('@expo/config-plugins')

// const withMyConfigPlugins = (config) => {
//   return withPlugins(config, [])
// }
// oxlint-disable-next-line effect/noDynamicImports -- Expo config-plugin entrypoint: Expo's prebuild loads `app.plugin.js` with a synchronous CommonJS `require`, so this file must stay CJS and re-export the built plugin the same way.
module.exports = require("./plugin/build/withVoidhashReactNative");
