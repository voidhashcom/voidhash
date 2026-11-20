import type { ConfigPlugin } from "expo/config-plugins";
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
export declare const RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";
declare const _default: ConfigPlugin<void | VoidhashPluginOptions>;
export default _default;
