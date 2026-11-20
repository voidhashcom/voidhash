"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENDERER_GRADLE_PROPERTY = void 0;
/* oxlint-disable effect/use-path-service, effect/prefer-effect-is, effect/prefer-option-over-null, effect/no-length-comparison, effect/prefer-arr-match, typescript/unbound-method -- Expo plugins run in CommonJS and cannot import the ESM-only Effect runtime. */
const node_path_1 = require("node:path");
const config_plugins_1 = require("expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
/** Gradle property the Android module reads to add the renderer. */
exports.RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";
/** Podfile global the podspec reads to add the renderer. */
const RENDERER_PODFILE_GLOBAL = "$VoidhashRenderer";
/** Podfile global that makes the podspec depend on pods the Podfile declares instead. */
const SOURCE_PODS_PODFILE_GLOBAL = "$VoidhashNativeSdkPods";
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
const PODFILE_BLOCK_TAG = `${package_json_1.default.name}-core-pod`;
const SETTINGS_BLOCK_TAG = `${package_json_1.default.name}-native-sdk`;
/**
 * True when the Podfile declares `podName` outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents, podName) => {
  const contentsWithoutBlock = contents.replace(
    new RegExp(
      `# @generated begin ${PODFILE_BLOCK_TAG}.*# @generated end ${PODFILE_BLOCK_TAG}`,
      "s",
    ),
    "",
  );
  return (
    contentsWithoutBlock.includes(`pod "${podName}"`) ||
    contentsWithoutBlock.includes(`pod '${podName}'`)
  );
};
/**
 * Tells `NitroVoidhash.podspec` what to link through Podfile globals, set inside the app target
 * before the pods are evaluated: the renderer, and, building from source, that the SDK pods come
 * from the `:path` declarations next to them instead of Swift Package Manager.
 */
const withVoidhashPodfile = (config, { renderer, nativeSdkPath }) =>
  (0, config_plugins_1.withPodfile)(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    const lines = [];
    if (renderer) lines.push(`  ${RENDERER_PODFILE_GLOBAL} = true`);
    if (nativeSdkPath !== undefined) {
      const nativeSdkDirectory = (0, node_path_1.resolve)(
        podfileConfig.modRequest.projectRoot,
        nativeSdkPath,
      );
      lines.push(`  ${SOURCE_PODS_PODFILE_GLOBAL} = true`);
      const pods = [
        { directory: (0, node_path_1.resolve)(nativeSdkDirectory, "ios"), name: "VoidhashCore" },
        { directory: (0, node_path_1.resolve)(nativeSdkDirectory, "ios"), name: "Voidhash" },
        ...(renderer
          ? [
              {
                directory: (0, node_path_1.resolve)(nativeSdkDirectory, "ios-ui"),
                name: "VoidhashUI",
              },
            ]
          : []),
      ].filter((pod) => !hasManualPodDeclaration(contents, pod.name));
      lines.push(
        ...pods.map(
          (pod) =>
            `  pod "${pod.name}", :path => "${(0, node_path_1.relative)(podfileConfig.modRequest.platformProjectRoot, pod.directory)}"`,
        ),
      );
    }
    if (lines.length === 0) {
      podfileConfig.modResults.contents = config_plugins_1.CodeGenerator.removeContents({
        src: contents,
        tag: PODFILE_BLOCK_TAG,
      }).contents;
      return podfileConfig;
    }
    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      // Without them, the build links a different set of native SDKs than configured.
      config_plugins_1.WarningAggregator.addWarningIOS(
        package_json_1.default.name,
        `The Podfile has no use_expo_modules! or use_native_modules! line, so the Voidhash settings were not added. Add these lines to the app target:\n${lines.join("\n")}`,
      );
      return podfileConfig;
    }
    podfileConfig.modResults.contents = config_plugins_1.CodeGenerator.mergeContents({
      tag: PODFILE_BLOCK_TAG,
      src: contents,
      newSrc: lines.join("\n"),
      anchor,
      offset: 0,
      comment: "#",
    }).contents;
    return podfileConfig;
  });
/**
 * Building from source, includes the Android SDK's modules as projects of the app, named after
 * the artifacts they publish; the React Native module depends on those projects then instead of
 * the `com.voidhash` artifacts. They join the app's own build rather than coming in as an included
 * build, so they build with the app's Android Gradle plugin, whatever version that is.
 */
const withVoidhashSettingsGradle = (config, { renderer, nativeSdkPath }) =>
  (0, config_plugins_1.withSettingsGradle)(config, (settingsConfig) => {
    const { projectRoot, platformProjectRoot } = settingsConfig.modRequest;
    const removed = config_plugins_1.CodeGenerator.removeContents({
      src: settingsConfig.modResults.contents,
      tag: SETTINGS_BLOCK_TAG,
    });
    // Without the blank line the block was written after.
    const contents = removed.didClear ? `${removed.contents.trimEnd()}\n` : removed.contents;
    if (nativeSdkPath === undefined) {
      settingsConfig.modResults.contents = contents;
      return settingsConfig;
    }
    const sources = (0, node_path_1.relative)(
      platformProjectRoot,
      (0, node_path_1.resolve)(projectRoot, nativeSdkPath, "android"),
    );
    const modules = [
      { project: ":voidhash-core", directory: "core" },
      { project: ":voidhash", directory: "sdk" },
      ...(renderer ? [{ project: ":voidhash-ui", directory: "ui" }] : []),
    ];
    // The modules name each other by these project paths (see the Android SDK's settings).
    const projectPaths =
      settingsConfig.modResults.language === "kt"
        ? [
            "gradle.beforeProject {",
            '  extensions.extraProperties["voidhash.coreProjectPath"] = ":voidhash-core"',
            '  extensions.extraProperties["voidhash.sdkProjectPath"] = ":voidhash"',
            "}",
          ]
        : [
            "gradle.beforeProject { project ->",
            '  project.ext.set("voidhash.coreProjectPath", ":voidhash-core")',
            '  project.ext.set("voidhash.sdkProjectPath", ":voidhash")',
            "}",
          ];
    const block = [
      `include(${modules.map((module) => `"${module.project}"`).join(", ")})`,
      ...modules.map(
        (module) =>
          `project("${module.project}").projectDir = file("${sources}/${module.directory}")`,
      ),
      ...projectPaths,
    ].join("\n");
    settingsConfig.modResults.contents = [
      contents.trimEnd(),
      "",
      config_plugins_1.CodeGenerator.createGeneratedHeaderComment(block, SETTINGS_BLOCK_TAG, "//"),
      block,
      `// @generated end ${SETTINGS_BLOCK_TAG}`,
      "",
    ].join("\n");
    return settingsConfig;
  });
/**
 * Sets the Gradle property the Android module reads to add the renderer, and removes it when the
 * option is off so turning it off takes effect on the next prebuild.
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
  const { renderer, nativeSdk } = options ?? {};
  const resolved = {
    renderer: renderer === true || renderer === "views",
    nativeSdkPath: nativeSdk?.path,
  };
  return withRendererGradleProperty(
    withVoidhashSettingsGradle(withVoidhashPodfile(config, resolved), resolved),
    resolved,
  );
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(
  withVoidhashReactNative,
  package_json_1.default.name,
  package_json_1.default.version,
);
