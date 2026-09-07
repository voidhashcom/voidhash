import type { ExpoConfig } from "expo/config";
import type { ConfigPlugin } from "expo/config-plugins";
import { AndroidConfig } from "expo/config-plugins";
/**
 * Mirrors `expo.scheme` into manifest meta-data. Android cannot enumerate its own
 * intent-filter schemes at runtime, so this is how the SDK learns the deep-link scheme when
 * `createVoidhashClient` is not given one explicitly.
 */
export declare const addSchemeMetaData: (
  manifest: AndroidConfig.Manifest.AndroidManifest,
  scheme: ExpoConfig["scheme"],
) => AndroidConfig.Manifest.AndroidManifest;
declare const _default: ConfigPlugin<void>;
export default _default;
