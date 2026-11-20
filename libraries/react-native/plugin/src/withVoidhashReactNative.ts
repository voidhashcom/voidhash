/* oxlint-disable effect/use-path-service, effect/prefer-effect-is, effect/prefer-option-over-null, effect/no-length-comparison, effect/prefer-arr-match, typescript/unbound-method -- Expo plugins run in CommonJS and cannot import the ESM-only Effect runtime. */
import { relative, resolve } from "node:path";
import type { ConfigPlugin } from "expo/config-plugins";
import {
  CodeGenerator,
  createRunOncePlugin,
  WarningAggregator,
  withGradleProperties,
  withPodfile,
  withSettingsGradle,
} from "expo/config-plugins";

import pkg from "../../package.json";

/** Options of the Voidhash config plugin. */
export interface VoidhashPluginOptions {
  /**
   * Adds the native flow renderer, which `presentFlow()` needs: on iOS the
   * `VoidhashUI` product, on Android `com.voidhash:voidhash-ui`. `"views"`, the
   * name of the renderer before it became the only one, adds the same. Off by
   * default, so apps that do not show flows do not ship it.
   */
  renderer?: boolean | "views";
  /**
   * Builds the native SDKs from a checkout of their sources instead of
   * installing the released ones (Swift Package Manager on iOS, Maven Central on
   * Android). For working on the SDKs themselves; apps leave it out.
   */
  nativeSdk?: {
    /**
     * The directory that holds the native SDKs' sources (`ios`, `ios-ui` and
     * `android`), absolute or relative to the app's project root.
     */
    path: string;
  };
}

/** Gradle property the Android module reads to add the renderer. */
export const RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";

/** Podfile global the podspec reads to add the renderer. */
const RENDERER_PODFILE_GLOBAL = "$VoidhashRenderer";

/** Podfile global that makes the podspec depend on pods the Podfile declares instead. */
const SOURCE_PODS_PODFILE_GLOBAL = "$VoidhashNativeSdkPods";

const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
const PODFILE_BLOCK_TAG = `${pkg.name}-core-pod`;
const SETTINGS_BLOCK_TAG = `${pkg.name}-native-sdk`;

interface ResolvedOptions {
  renderer: boolean;
  /** `nativeSdk.path`, when the native SDKs are built from source. */
  nativeSdkPath: string | undefined;
}

/**
 * True when the Podfile declares `podName` outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents: string, podName: string): boolean => {
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
const withVoidhashPodfile: ConfigPlugin<ResolvedOptions> = (config, { renderer, nativeSdkPath }) =>
  withPodfile(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    const lines: string[] = [];
    if (renderer) lines.push(`  ${RENDERER_PODFILE_GLOBAL} = true`);
    if (nativeSdkPath !== undefined) {
      const nativeSdkDirectory = resolve(podfileConfig.modRequest.projectRoot, nativeSdkPath);
      lines.push(`  ${SOURCE_PODS_PODFILE_GLOBAL} = true`);
      const pods = [
        { directory: resolve(nativeSdkDirectory, "ios"), name: "VoidhashCore" },
        { directory: resolve(nativeSdkDirectory, "ios"), name: "Voidhash" },
        ...(renderer
          ? [{ directory: resolve(nativeSdkDirectory, "ios-ui"), name: "VoidhashUI" }]
          : []),
      ].filter((pod) => !hasManualPodDeclaration(contents, pod.name));
      lines.push(
        ...pods.map(
          (pod) =>
            `  pod "${pod.name}", :path => "${relative(podfileConfig.modRequest.platformProjectRoot, pod.directory)}"`,
        ),
      );
    }

    if (lines.length === 0) {
      podfileConfig.modResults.contents = CodeGenerator.removeContents({
        src: contents,
        tag: PODFILE_BLOCK_TAG,
      }).contents;
      return podfileConfig;
    }

    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      // Without them, the build links a different set of native SDKs than configured.
      WarningAggregator.addWarningIOS(
        pkg.name,
        `The Podfile has no use_expo_modules! or use_native_modules! line, so the Voidhash settings were not added. Add these lines to the app target:\n${lines.join("\n")}`,
      );
      return podfileConfig;
    }

    podfileConfig.modResults.contents = CodeGenerator.mergeContents({
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
const withVoidhashSettingsGradle: ConfigPlugin<ResolvedOptions> = (
  config,
  { renderer, nativeSdkPath },
) =>
  withSettingsGradle(config, (settingsConfig) => {
    const { projectRoot, platformProjectRoot } = settingsConfig.modRequest;
    const removed = CodeGenerator.removeContents({
      src: settingsConfig.modResults.contents,
      tag: SETTINGS_BLOCK_TAG,
    });
    // Without the blank line the block was written after.
    const contents = removed.didClear ? `${removed.contents.trimEnd()}\n` : removed.contents;
    if (nativeSdkPath === undefined) {
      settingsConfig.modResults.contents = contents;
      return settingsConfig;
    }
    const sources = relative(platformProjectRoot, resolve(projectRoot, nativeSdkPath, "android"));
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
      CodeGenerator.createGeneratedHeaderComment(block, SETTINGS_BLOCK_TAG, "//"),
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
const withRendererGradleProperty: ConfigPlugin<ResolvedOptions> = (config, { renderer }) =>
  withGradleProperties(config, (gradleConfig) => {
    const properties = gradleConfig.modResults.filter(
      (item) => item.type !== "property" || item.key !== RENDERER_GRADLE_PROPERTY,
    );
    gradleConfig.modResults = renderer
      ? [...properties, { key: RENDERER_GRADLE_PROPERTY, type: "property", value: "true" }]
      : properties;
    return gradleConfig;
  });

const withVoidhashReactNative: ConfigPlugin<VoidhashPluginOptions | void> = (config, options) => {
  const { renderer, nativeSdk } = options ?? {};
  const resolved: ResolvedOptions = {
    renderer: renderer === true || renderer === "views",
    nativeSdkPath: nativeSdk?.path,
  };
  return withRendererGradleProperty(
    withVoidhashSettingsGradle(withVoidhashPodfile(config, resolved), resolved),
    resolved,
  );
};

export default createRunOncePlugin(withVoidhashReactNative, pkg.name, pkg.version);
