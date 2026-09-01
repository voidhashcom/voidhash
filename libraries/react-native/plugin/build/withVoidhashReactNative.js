"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const require_utils_1 = require("@expo/require-utils");
const config_plugins_1 = require("expo/config-plugins");
const pathe_1 = require("pathe");
const package_json_1 = __importDefault(require("../../package.json"));
const PACKAGE_ROOT = (0, pathe_1.resolve)(__dirname, "..", "..");
const POD_NAMES = ["VoidhashCore", "Voidhash"];
const PODFILE_ANCHORS = [/use_expo_modules!/, /use_native_modules!/];
/**
 * Resolves the directory of the `@voidhash/ios` package, which holds `VoidhashCore.podspec`.
 *
 * Falls back to the in-repo sibling library so the plugin also works from a source checkout
 * where the workspace dependency is not installed.
 */
const resolveCorePodDirectory = () => {
    const installedPackage = (0, require_utils_1.resolveFrom)(PACKAGE_ROOT, "@voidhash/ios/package.json");
    if (installedPackage)
        return (0, pathe_1.dirname)(installedPackage);
    return (0, pathe_1.resolve)(PACKAGE_ROOT, "..", "ios");
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
    const contentsWithoutBlock = contents.replace(new RegExp(`# @generated begin ${GENERATED_BLOCK_TAG}.*# @generated end ${GENERATED_BLOCK_TAG}`, "s"), "");
    return POD_NAMES.some((podName) => contentsWithoutBlock.includes(`pod "${podName}"`) ||
        contentsWithoutBlock.includes(`pod '${podName}'`));
};
const withVoidhashCorePod = (config) => (0, config_plugins_1.withPodfile)(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    if (hasManualPodDeclaration(contents)) {
        return podfileConfig;
    }
    const anchor = PODFILE_ANCHORS.find((candidate) => candidate.test(contents));
    if (anchor === undefined) {
        return podfileConfig;
    }
    const podDirectory = (0, pathe_1.relative)(podfileConfig.modRequest.platformProjectRoot, resolveCorePodDirectory());
    // VoidhashCore is the shared native core; Voidhash is the bare-native client the
    // SDK embeds as its data-plane engine.
    const generatedPods = POD_NAMES.map((podName) => `  pod "${podName}", :path => "${podDirectory}"`).join("\n");
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
const withVoidhashReactNative = (config) => withVoidhashCorePod(config);
exports.default = (0, config_plugins_1.createRunOncePlugin)(withVoidhashReactNative, package_json_1.default.name, package_json_1.default.version);
