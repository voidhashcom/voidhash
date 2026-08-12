import type { Properties } from "csstype";

import { buildViewStyles, type ViewStyleInput } from "./view-styles";

/** RN ScrollView node data driving the overflow/axis lowering. */
export interface ScrollViewOptions {
  /** RN `horizontal`: lay children out along the row axis and scroll on X. */
  horizontal: boolean;
  /** RN `showsScrollIndicator`: whether the native scrollbar is visible. */
  showsScrollIndicator: boolean;
}

/**
 * Lowers a scrollView node onto the web. Builds the shared view style surface
 * ({@link buildViewStyles}) then layers RN ScrollView overflow semantics on top,
 * mirroring the preview-tree `SCROLL_BASE` (vertical `overflowY: auto`) but
 * honoring the document's `horizontal`/`showsScrollIndicator` fields:
 *
 * - vertical (default): `overflowY: auto`, `overflowX: hidden`;
 * - `horizontal: true`: `overflowX: auto`, `overflowY: hidden`, and
 *   `flexDirection: row` (RN horizontal ScrollView flows children in a row
 *   regardless of the authored direction);
 * - `showsScrollIndicator: false`: `scrollbarWidth: none`. NOTE: this hides the
 *   scrollbar in Firefox and standards-compliant engines; WebKit needs a
 *   `::-webkit-scrollbar { display: none }` rule which cannot be expressed as
 *   an inline style, so it is not applied by these inline-only renderers.
 *
 * Yoga-vs-CSS min-size: React Native (Yoga) defaults a flex item's minimum main
 * size to 0, but CSS defaults `min-height`/`min-width` to `auto` — which floors
 * a flex item at its content size. Without an explicit `min-*: 0`, a scrollView
 * taller than the viewport can never shrink below its content, so `flex-shrink`
 * is inert and `overflowY: auto` has nothing to scroll. We therefore default
 * `minHeight`/`minWidth` to `0` (matching the preview-tree `VIEW_BASE`), but
 * only when the author hasn't set them — {@link buildViewStyles} emits those
 * keys only when present, so authored values are already in `styles` and win.
 */
export function buildScrollViewStyles(
  style: ViewStyleInput,
  { horizontal, showsScrollIndicator }: ScrollViewOptions,
): Properties {
  const styles = buildViewStyles(style);

  styles.minHeight ??= 0;
  styles.minWidth ??= 0;

  styles.WebkitOverflowScrolling = "touch";

  if (horizontal) {
    styles.flexDirection = "row";
    styles.overflowX = "auto";
    styles.overflowY = "hidden";
  } else {
    styles.overflowX = "hidden";
    styles.overflowY = "auto";
  }

  if (!showsScrollIndicator) {
    styles.scrollbarWidth = "none";
  }

  return styles;
}
