import type { ConfigPlugin } from "expo/config-plugins";
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
/** Gradle property the Android module reads to compile the renderer in. */
export declare const RENDERER_GRADLE_PROPERTY = "Voidhash_renderer";
declare const _default: ConfigPlugin<void | VoidhashPluginOptions>;
export default _default;
