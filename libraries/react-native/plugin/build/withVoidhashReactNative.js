"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
// oxlint-disable effect/noDynamicImports -- Expo prebuild loads config plugins through CommonJS `require`, so this file compiles to CJS and locates the shared native core with `require.resolve`.
// oxlint-disable effect/noNodeBuiltinImport -- Config plugins run in Expo's Node CLI, outside any Effect runtime, so `node:path` is the only path API available here.
// oxlint-disable effect/noTryCatch -- `require.resolve` signals "not installed" by throwing; there is no non-throwing resolver in CommonJS.
const node_path_1 = __importDefault(require("node:path"));
const config_plugins_1 = require("expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
const PACKAGE_ROOT = node_path_1.default.resolve(__dirname, "..", "..");
const POD_NAME = "VoidhashCore";
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
/**
 * Resolves the directory of the `@voidhash/ios` package, which holds `VoidhashCore.podspec`.
 *
 * Falls back to the in-repo sibling library so the plugin also works from a source checkout
 * where the workspace dependency is not installed.
 */
const resolveCorePodDirectory = () => {
  try {
    return node_path_1.default.dirname(
      require.resolve("@voidhash/ios/package.json", { paths: [PACKAGE_ROOT] }),
    );
  } catch {
    return node_path_1.default.resolve(PACKAGE_ROOT, "..", "ios");
  }
};
/**
 * Adds the `VoidhashCore` development pod — the shared native core the Nitro module links
 * against — to the app's Podfile.
 */
const GENERATED_BLOCK_TAG = `${package_json_1.default.name}-core-pod`;
/**
 * True when the Podfile declares the pod outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents) => {
  const withoutGeneratedBlock = contents.replace(
    new RegExp(
      `# @generated begin ${GENERATED_BLOCK_TAG}.*# @generated end ${GENERATED_BLOCK_TAG}`,
      "s",
    ),
    "",
  );
  return (
    withoutGeneratedBlock.includes(`pod "${POD_NAME}"`) ||
    withoutGeneratedBlock.includes(`pod '${POD_NAME}'`)
  );
};
const withVoidhashCorePod = (config) =>
  (0, config_plugins_1.withPodfile)(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    if (hasManualPodDeclaration(contents)) {
      return podfileConfig;
    }
    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      return podfileConfig;
    }
    const podDirectory = node_path_1.default.relative(
      podfileConfig.modRequest.platformProjectRoot,
      resolveCorePodDirectory(),
    );
    podfileConfig.modResults.contents = config_plugins_1.CodeGenerator.mergeContents({
      tag: GENERATED_BLOCK_TAG,
      src: contents,
      newSrc: `  pod "${POD_NAME}", :path => "${podDirectory}"`,
      anchor,
      offset: 1,
      comment: "#",
    }).contents;
    return podfileConfig;
  });
const withVoidhashReactNative = (config) => withVoidhashCorePod(config);
exports.default = (0, config_plugins_1.createRunOncePlugin)(
  withVoidhashReactNative,
  package_json_1.default.name,
  package_json_1.default.version,
);
