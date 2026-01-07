import type { TextNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { px } from "./utils";

export function buildTextStyles(style: TextNodeData["style"]): Properties {
  const styles: Properties = {
    color: style.color,
    display: style.display,
    fontSize: px(style.fontSize),
    fontWeight: style.fontWeight,
    letterSpacing: px(style.letterSpacing),
    lineHeight: style.lineHeight,
    marginBottom: px(style.marginBottom ?? 0),
    marginLeft: px(style.marginLeft ?? 0),
    marginRight: px(style.marginRight ?? 0),
    marginTop: px(style.marginTop ?? 0),
    opacity: style.opacity,
    overflow: style.overflow,
    textAlign: style.textAlign,
  };

  // Min/max constraints
  if (style.minWidth !== null) {
    styles.minWidth = px(style.minWidth);
  }
  if (style.maxWidth !== null) {
    styles.maxWidth = px(style.maxWidth);
  }
  if (style.minHeight !== null) {
    styles.minHeight = px(style.minHeight);
  }
  if (style.maxHeight !== null) {
    styles.maxHeight = px(style.maxHeight);
  }

  // Border
  if (style.borderEnabled) {
    styles.borderTopWidth = px(style.borderWidthTop ?? 0);
    styles.borderRightWidth = px(style.borderWidthRight ?? 0);
    styles.borderBottomWidth = px(style.borderWidthBottom ?? 0);
    styles.borderLeftWidth = px(style.borderWidthLeft ?? 0);
    styles.borderColor = style.borderColor;
    styles.borderStyle = style.borderStyle;
  }

  // Flex child properties
  if (style.flex !== null) {
    styles.flex = style.flex;
  }
  if (style.alignSelf !== "auto") {
    styles.alignSelf = style.alignSelf;
  }

  return styles;
}
