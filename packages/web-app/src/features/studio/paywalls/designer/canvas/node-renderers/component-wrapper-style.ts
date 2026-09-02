import { buildPreviewNodeStyles, type PreviewNode } from "@voidhash/paywall-renderer-web-core";
import type { CSSProperties } from "react";

/** Mirrors a component preview root's flex-child sizing onto Studio's selectable wrapper. */
export function componentWrapperStyle(root: PreviewNode | undefined): CSSProperties {
  if (root === undefined || !("style" in root)) return {};
  const style = root.style;
  const css = buildPreviewNodeStyles(style, root.type);
  return {
    ...(style.flex === undefined ? {} : { flex: css.flex }),
    ...(style.flexGrow === undefined ? {} : { flexGrow: css.flexGrow }),
    ...(style.flexShrink === undefined ? {} : { flexShrink: css.flexShrink }),
    ...(style.flexBasis === undefined ? {} : { flexBasis: css.flexBasis }),
    ...(style.alignSelf === undefined ? {} : { alignSelf: css.alignSelf }),
  };
}
