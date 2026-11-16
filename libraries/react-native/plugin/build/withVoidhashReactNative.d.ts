import type { ConfigPlugin } from "expo/config-plugins";
/** Options of the Voidhash config plugin. */
export interface VoidhashPluginOptions {
  /**
   * Adds the native flow renderer, which `presentFlow()` needs: the
   * `VoidhashUI` pod on iOS and the renderer module on Android. Off by
   * default, so apps that do not show flows do not ship it.
   */
  renderer?: boolean;
}
/** Gradle property the Android module reads to compile the renderer in. */
export declare const RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";
declare const _default: ConfigPlugin<void | VoidhashPluginOptions>;
export default _default;
