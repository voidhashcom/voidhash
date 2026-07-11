import type { TextNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { px } from "./utils";

export function buildTextStyles(style: TextNodeData["data"]["style"]): Properties {
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
    position: style.position ?? "relative",
    textAlign: style.textAlign,
  };

  // Min/max constraints — absent means unconstrained
  if (style.minWidth !== undefined) {
    styles.minWidth = px(style.minWidth);
  }
  if (style.maxWidth !== undefined) {
    styles.maxWidth = px(style.maxWidth);
  }
  if (style.minHeight !== undefined) {
    styles.minHeight = px(style.minHeight);
  }
  if (style.maxHeight !== undefined) {
    styles.maxHeight = px(style.maxHeight);
  }

  // Position offsets — a numeric offset emits px; the "auto" default (or absent)
  // is the CSS default and is left unset so it never overrides parent flow.
  if (typeof style.left === "number") {
    styles.left = px(style.left);
  }
  if (typeof style.top === "number") {
    styles.top = px(style.top);
  }
  if (typeof style.right === "number") {
    styles.right = px(style.right);
  }
  if (typeof style.bottom === "number") {
    styles.bottom = px(style.bottom);
  }

  // Border
  if (style.borderEnabled) {
    styles.borderTopWidth = px(style.borderTopWidth ?? 0);
    styles.borderRightWidth = px(style.borderRightWidth ?? 0);
    styles.borderBottomWidth = px(style.borderBottomWidth ?? 0);
    styles.borderLeftWidth = px(style.borderLeftWidth ?? 0);
    styles.borderColor = style.borderColor;
    styles.borderStyle = style.borderStyle;
  }

  // Flex child properties — absent means no explicit flex
  if (style.flex !== undefined) {
    styles.flex = style.flex;
  }
  if (style.alignSelf !== "auto") {
    styles.alignSelf = style.alignSelf;
  }

  return styles;
}
