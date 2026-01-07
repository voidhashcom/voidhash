import type { FlexNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { px, pxOrAuto } from "./utils";

export function buildFlexStyles(style: FlexNodeData["style"]): Properties {
  const styles: Properties = {
    alignItems: style.alignItems,
    boxSizing: "border-box",
    display: style.display,
    flexDirection: style.flexDirection,
    gap: px(style.gap ?? 0),
    height: pxOrAuto(style.height),
    justifyContent: style.justifyContent,
    marginBottom: px(style.marginBottom ?? 0),
    marginLeft: px(style.marginLeft ?? 0),
    marginRight: px(style.marginRight ?? 0),
    marginTop: px(style.marginTop ?? 0),
    opacity: style.opacity,
    overflow: style.overflow,
    paddingBottom: px(style.paddingBottom ?? 0),
    paddingLeft: px(style.paddingLeft ?? 0),
    paddingRight: px(style.paddingRight ?? 0),
    paddingTop: px(style.paddingTop ?? 0),
    position: "relative",
    width: pxOrAuto(style.width),
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

  // Background
  if (style.backgroundEnabled) {
    styles.backgroundColor = style.backgroundColor;
  } else {
    styles.backgroundColor = "transparent";
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

  // Border radius
  styles.borderTopLeftRadius = px(style.borderRadiusTopLeft ?? 0);
  styles.borderTopRightRadius = px(style.borderRadiusTopRight ?? 0);
  styles.borderBottomRightRadius = px(style.borderRadiusBottomRight ?? 0);
  styles.borderBottomLeftRadius = px(style.borderRadiusBottomLeft ?? 0);

  // Flex child properties
  if (style.flex !== null) {
    styles.flex = style.flex;
  }
  if (style.alignSelf !== "auto") {
    styles.alignSelf = style.alignSelf;
  }

  return styles;
}
