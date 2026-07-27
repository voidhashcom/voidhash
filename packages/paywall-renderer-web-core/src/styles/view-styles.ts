import type { ViewNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { buildBackgroundStyles } from "./background";
import { px, pxOrAuto } from "./utils";

type ViewStyle = ViewNodeData["data"]["style"];

type PositionField = "position" | "left" | "top" | "right" | "bottom";

/**
 * View style with the absolute-positioning fields optional, so screen styles
 * (which don't carry them) can be lowered through the same converter and fall
 * back to the relative-flow defaults.
 */
export type ViewStyleInput = Omit<ViewStyle, PositionField> &
  Partial<Pick<ViewStyle, PositionField>>;

export function buildViewStyles(style: ViewStyleInput): Properties {
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
    position: style.position ?? "relative",
    width: pxOrAuto(style.width),
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

  // Background
  Object.assign(styles, buildBackgroundStyles(style));

  // Border
  if (style.borderEnabled) {
    styles.borderTopWidth = px(style.borderTopWidth ?? 0);
    styles.borderRightWidth = px(style.borderRightWidth ?? 0);
    styles.borderBottomWidth = px(style.borderBottomWidth ?? 0);
    styles.borderLeftWidth = px(style.borderLeftWidth ?? 0);
    styles.borderColor = style.borderColor;
    styles.borderStyle = style.borderStyle;
  }

  // Border radius
  styles.borderTopLeftRadius = px(style.borderTopLeftRadius ?? 0);
  styles.borderTopRightRadius = px(style.borderTopRightRadius ?? 0);
  styles.borderBottomRightRadius = px(style.borderBottomRightRadius ?? 0);
  styles.borderBottomLeftRadius = px(style.borderBottomLeftRadius ?? 0);

  // Flex child properties — absent means no explicit flex
  if (style.flex !== undefined) {
    styles.flex = style.flex;
  }
  if (style.alignSelf !== "auto") {
    styles.alignSelf = style.alignSelf;
  }

  return styles;
}
