/* oxlint-disable effect/avoid-try-catch, effect/use-path-service, effect/prefer-effect-is, effect/no-length-comparison, effect/prefer-arr-match, typescript/unbound-method -- Expo plugins run in CommonJS and cannot import the ESM-only Effect runtime. */
import { dirname, relative, resolve } from "node:path";
import type { ConfigPlugin } from "expo/config-plugins";
import {
  CodeGenerator,
  createRunOncePlugin,
  WarningAggregator,
  withGradleProperties,
  withPodfile,
} from "expo/config-plugins";

import pkg from "../../package.json";

declare const __dirname: string;

const PACKAGE_ROOT = resolve(__dirname, "..", "..");
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];

/** Options of the Voidhash config plugin. */
export interface VoidhashPluginOptions {
  /**
   * Adds the native flow renderer, which `presentFlow()` needs: on iOS the
   * `VoidhashUI` pod, or with `"views"` the `VoidhashUIViews` pod, which draws
   * flows with UIKit's own views (the two cannot be linked into one app); on
   * Android the renderer module, which carries both. Off by default, so apps
   * that do not show flows do not ship it.
   */
  renderer?: boolean | "views";
}

/** The renderer the app adds. */
type Renderer = "engine" | "views" | "none";

/** Gradle property the Android module reads to compile the renderer in. */
export const RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";

/**
 * Resolves the directory of the `@voidhash/ios` package, which holds `VoidhashCore.podspec`.
 *
 * Falls back to the in-repo sibling library so the plugin also works from a source checkout
 * where the workspace dependency is not installed.
 */
const resolveCorePodDirectory = (): string => {
  try {
    return dirname(require.resolve("@voidhash/ios/package.json", { paths: [PACKAGE_ROOT] }));
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "MODULE_NOT_FOUND"
    )
      throw error;
    return resolve(PACKAGE_ROOT, "..", "ios");
  }
};

/**
 * Adds the development pods the Nitro module links against to the app's Podfile: `VoidhashCore`
 * and `Voidhash` from `@voidhash/ios`, and with the renderer option the `VoidhashUI` renderer,
 * which lives next to them.
 */
const GENERATED_BLOCK_TAG = `${pkg.name}-core-pod`;

/**
 * True when the Podfile declares `podName` outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents: string, podName: string): boolean => {
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

const withVoidhashPods: ConfigPlugin<{ renderer: Renderer }> = (config, { renderer }) =>
  withPodfile(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    const coreDirectory = resolveCorePodDirectory();
    const pods = [
      { directory: coreDirectory, name: "VoidhashCore" },
      { directory: coreDirectory, name: "Voidhash" },
      ...(renderer === "none"
        ? []
        : [
            {
              directory: resolve(coreDirectory, "..", "ios-ui"),
              name: renderer === "views" ? "VoidhashUIViews" : "VoidhashUI",
            },
          ]),
    ].filter((pod) => !hasManualPodDeclaration(contents, pod.name));

    if (pods.length === 0) {
      return podfileConfig;
    }

    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      // Without the pods, `pod install` fails later with an error that does not name this step.
      const names = pods.map((pod) => `pod "${pod.name}"`).join(", ");
      WarningAggregator.addWarningIOS(
        pkg.name,
        `The Podfile has no use_expo_modules! or use_native_modules! line, so the Voidhash pods were not added. Declare ${names} in the app target, with :path pointing at the installed @voidhash/ios package.`,
      );
      return podfileConfig;
    }

    podfileConfig.modResults.contents = CodeGenerator.mergeContents({
      tag: GENERATED_BLOCK_TAG,
      src: contents,
      newSrc: pods
        .map(
          (pod) =>
            `  pod "${pod.name}", :path => "${relative(podfileConfig.modRequest.platformProjectRoot, pod.directory)}"`,
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
const withRendererGradleProperty: ConfigPlugin<{ renderer: Renderer }> = (config, { renderer }) =>
  withGradleProperties(config, (gradleConfig) => {
    const properties = gradleConfig.modResults.filter(
      (item) => item.type !== "property" || item.key !== RENDERER_GRADLE_PROPERTY,
    );
    gradleConfig.modResults =
      renderer !== "none"
        ? [...properties, { key: RENDERER_GRADLE_PROPERTY, type: "property", value: "true" }]
        : properties;
    return gradleConfig;
  });

const withVoidhashReactNative: ConfigPlugin<VoidhashPluginOptions | void> = (config, options) => {
  const option = (options ?? {}).renderer;
  const renderer: Renderer = option === "views" ? "views" : option === true ? "engine" : "none";
  return withRendererGradleProperty(withVoidhashPods(config, { renderer }), { renderer });
};

export default createRunOncePlugin(withVoidhashReactNative, pkg.name, pkg.version);
