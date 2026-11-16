"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENDERER_GRADLE_PROPERTY = void 0;
/* oxlint-disable effect/avoid-try-catch, effect/use-path-service, effect/prefer-effect-is, effect/no-length-comparison, effect/prefer-arr-match, typescript/unbound-method -- Expo plugins run in CommonJS and cannot import the ESM-only Effect runtime. */
const node_path_1 = require("node:path");
const config_plugins_1 = require("expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
const PACKAGE_ROOT = (0, node_path_1.resolve)(__dirname, "..", "..");
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
/** Gradle property the Android module reads to compile the renderer in. */
exports.RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";
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
 * Adds the development pods the Nitro module links against to the app's Podfile: `VoidhashCore`
 * and `Voidhash` from `@voidhash/ios`, and with the renderer option the `VoidhashUI` renderer,
 * which lives next to them.
 */
const GENERATED_BLOCK_TAG = `${package_json_1.default.name}-core-pod`;
/**
 * True when the Podfile declares `podName` outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents, podName) => {
  const contentsWithoutBlock = contents.replace(
    new RegExp(
      `# @generated begin ${GENERATED_BLOCK_TAG}.*# @generated end ${GENERATED_BLOCK_TAG}`,
      "s",
    ),
    "",
  );
  return (
    contentsWithoutBlock.includes(`pod "${podName}"`) ||
    contentsWithoutBlock.includes(`pod '${podName}'`)
  );
};
const withVoidhashPods = (config, { renderer }) =>
  (0, config_plugins_1.withPodfile)(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    const coreDirectory = resolveCorePodDirectory();
    const pods = [
      { directory: coreDirectory, name: "VoidhashCore" },
      { directory: coreDirectory, name: "Voidhash" },
      ...(renderer
        ? [
            {
              directory: (0, node_path_1.resolve)(coreDirectory, "..", "ios-ui"),
              name: "VoidhashUI",
            },
          ]
        : []),
    ].filter((pod) => !hasManualPodDeclaration(contents, pod.name));
    if (pods.length === 0) {
      return podfileConfig;
    }
    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      // Without the pods, `pod install` fails later with an error that does not name this step.
      const names = pods.map((pod) => `pod "${pod.name}"`).join(", ");
      config_plugins_1.WarningAggregator.addWarningIOS(
        package_json_1.default.name,
        `The Podfile has no use_expo_modules! or use_native_modules! line, so the Voidhash pods were not added. Declare ${names} in the app target, with :path pointing at the installed @voidhash/ios package.`,
      );
      return podfileConfig;
    }
    podfileConfig.modResults.contents = config_plugins_1.CodeGenerator.mergeContents({
      tag: GENERATED_BLOCK_TAG,
      src: contents,
      newSrc: pods
        .map(
          (pod) =>
            `  pod "${pod.name}", :path => "${(0, node_path_1.relative)(podfileConfig.modRequest.platformProjectRoot, pod.directory)}"`,
        )
        .join("\n"),
      anchor,
      offset: 1,
      comment: "#",
    }).contents;
    return podfileConfig;
  });
/**
 * Sets the Gradle property the Android module reads to compile the renderer in, and removes it
 * when the option is off so turning it off takes effect on the next prebuild.
 */
const withRendererGradleProperty = (config, { renderer }) =>
  (0, config_plugins_1.withGradleProperties)(config, (gradleConfig) => {
    const properties = gradleConfig.modResults.filter(
      (item) => item.type !== "property" || item.key !== exports.RENDERER_GRADLE_PROPERTY,
    );
    gradleConfig.modResults = renderer
      ? [...properties, { key: exports.RENDERER_GRADLE_PROPERTY, type: "property", value: "true" }]
      : properties;
    return gradleConfig;
  });
const withVoidhashReactNative = (config, options) => {
  const renderer = (options ?? {}).renderer === true;
  return withRendererGradleProperty(withVoidhashPods(config, { renderer }), { renderer });
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(
  withVoidhashReactNative,
  package_json_1.default.name,
  package_json_1.default.version,
);
