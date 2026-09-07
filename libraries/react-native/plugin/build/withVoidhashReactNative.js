"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSchemeMetaData = void 0;
/* oxlint-disable effect/avoid-try-catch, effect/use-path-service, effect/prefer-effect-is, typescript/unbound-method -- Expo plugins run in CommonJS and cannot import the ESM-only Effect runtime. */
const node_path_1 = require("node:path");
const config_plugins_1 = require("expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
const PACKAGE_ROOT = (0, node_path_1.resolve)(__dirname, "..", "..");
const POD_NAMES = ["VoidhashCore", "Voidhash"];
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
/**
 * Resolves the directory of the `@voidhash/ios` package, which holds `VoidhashCore.podspec`.
 *
 * Falls back to the in-repo sibling library so the plugin also works from a source checkout
 * where the workspace dependency is not installed.
 */
const resolveCorePodDirectory = () => {
  try {
    return (0, node_path_1.dirname)(
      require.resolve("@voidhash/ios/package.json", { paths: [PACKAGE_ROOT] }),
    );
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "MODULE_NOT_FOUND"
    )
      throw error;
    return (0, node_path_1.resolve)(PACKAGE_ROOT, "..", "ios");
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
  const contentsWithoutBlock = contents.replace(
    new RegExp(
      `# @generated begin ${GENERATED_BLOCK_TAG}.*# @generated end ${GENERATED_BLOCK_TAG}`,
      "s",
    ),
    "",
  );
  return POD_NAMES.some(
    (podName) =>
      contentsWithoutBlock.includes(`pod "${podName}"`) ||
      contentsWithoutBlock.includes(`pod '${podName}'`),
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
    const podDirectory = (0, node_path_1.relative)(
      podfileConfig.modRequest.platformProjectRoot,
      resolveCorePodDirectory(),
    );
    // VoidhashCore is the shared native core; Voidhash is the bare-native client the
    // SDK embeds as its data-plane engine.
    const generatedPods = POD_NAMES.map(
      (podName) => `  pod "${podName}", :path => "${podDirectory}"`,
    ).join("\n");
    podfileConfig.modResults.contents = config_plugins_1.CodeGenerator.mergeContents({
      tag: GENERATED_BLOCK_TAG,
      src: contents,
      newSrc: generatedPods,
      anchor,
      offset: 1,
      comment: "#",
    }).contents;
    return podfileConfig;
  });
/** Manifest meta-data key the native `VoidhashPlatform` hybrid reads the URL scheme(s) from. */
const SCHEME_META_DATA_KEY = "com.voidhash.sdk.scheme";
/**
 * Mirrors `expo.scheme` into manifest meta-data. Android cannot enumerate its own
 * intent-filter schemes at runtime, so this is how the SDK learns the deep-link scheme when
 * `createVoidhashClient` is not given one explicitly.
 */
const addSchemeMetaData = (manifest, scheme) => {
  const schemes = [scheme].flat().filter(
    // oxlint-disable-next-line effect/prefer-effect-is -- the plugin is CommonJS and cannot import the ESM-only `effect`
    (candidate) => typeof candidate === "string" && candidate !== "",
  );
  const [firstScheme] = schemes;
  if (firstScheme === undefined) return manifest;
  const application = config_plugins_1.AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  config_plugins_1.AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    application,
    SCHEME_META_DATA_KEY,
    schemes.join(","),
  );
  return manifest;
};
exports.addSchemeMetaData = addSchemeMetaData;
const withVoidhashScheme = (config) =>
  (0, config_plugins_1.withAndroidManifest)(config, (manifestConfig) => {
    manifestConfig.modResults = (0, exports.addSchemeMetaData)(
      manifestConfig.modResults,
      config.scheme,
    );
    return manifestConfig;
  });
const withVoidhashReactNative = (config) => withVoidhashScheme(withVoidhashCorePod(config));
exports.default = (0, config_plugins_1.createRunOncePlugin)(
  withVoidhashReactNative,
  package_json_1.default.name,
  package_json_1.default.version,
);
