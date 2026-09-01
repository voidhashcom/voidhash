import { resolveFrom } from "@expo/require-utils";
import type { ConfigPlugin } from "expo/config-plugins";
import { CodeGenerator, createRunOncePlugin, withPodfile } from "expo/config-plugins";
import { dirname, relative, resolve } from "pathe";

import pkg from "../../package.json";

declare const __dirname: string;

const PACKAGE_ROOT = resolve(__dirname, "..", "..");
const POD_NAMES = ["VoidhashCore", "Voidhash"] as const;
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];

/**
 * Resolves the directory of the `@voidhash/ios` package, which holds `VoidhashCore.podspec`.
 *
 * Falls back to the in-repo sibling library so the plugin also works from a source checkout
 * where the workspace dependency is not installed.
 */
const resolveCorePodDirectory = (): string => {
  const installedPackage = resolveFrom(PACKAGE_ROOT, "@voidhash/ios/package.json");
  if (installedPackage) return dirname(installedPackage);
  return resolve(PACKAGE_ROOT, "..", "ios");
};

/**
 * Adds the `VoidhashCore` development pod — the shared native core the Nitro module links
 * against — to the app's Podfile.
 */
const GENERATED_BLOCK_TAG = `${pkg.name}-core-pod`;

/**
 * True when the Podfile declares the pod outside this plugin's generated block — i.e. the app
 * manages it manually. The generated block itself must not count, or `mergeContents` could never
 * refresh a stale `:path` on subsequent prebuilds.
 */
const hasManualPodDeclaration = (contents: string): boolean => {
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

const withVoidhashCorePod: ConfigPlugin<void> = (config) =>
  withPodfile(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;

    if (hasManualPodDeclaration(contents)) {
      return podfileConfig;
    }

    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
      return podfileConfig;
    }

    const podDirectory = relative(
      podfileConfig.modRequest.platformProjectRoot,
      resolveCorePodDirectory(),
    );

    // VoidhashCore is the shared native core; Voidhash is the bare-native client the
    // SDK embeds as its data-plane engine.
    const generatedPods = POD_NAMES.map(
      (podName) => `  pod "${podName}", :path => "${podDirectory}"`,
    ).join("\n");

    podfileConfig.modResults.contents = CodeGenerator.mergeContents({
      tag: GENERATED_BLOCK_TAG,
      src: contents,
      newSrc: generatedPods,
      anchor,
      offset: 1,
      comment: "#",
    }).contents;

    return podfileConfig;
  });

const withVoidhashReactNative: ConfigPlugin<void> = (config) => withVoidhashCorePod(config);

export default createRunOncePlugin(withVoidhashReactNative, pkg.name, pkg.version);
