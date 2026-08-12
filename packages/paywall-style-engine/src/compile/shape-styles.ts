import type { ShapeNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { px, pxOrAuto } from "./utils";

export function buildShapeContainerStyles(style: ShapeNodeData["data"]["style"]): Properties {
  const styles: Properties = {
    boxSizing: "border-box",
    display: style.display === "none" ? "none" : "block",
    height: pxOrAuto(style.height),
    marginBottom: px(style.marginBottom ?? 0),
    marginLeft: px(style.marginLeft ?? 0),
    marginRight: px(style.marginRight ?? 0),
    marginTop: px(style.marginTop ?? 0),
    opacity: style.opacity,
    position: "relative",
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

  // Flex child properties — absent means no explicit flex
  if (style.flex !== undefined) {
    styles.flex = style.flex;
  }
  if (style.alignSelf !== "auto") {
    styles.alignSelf = style.alignSelf;
  }

  return styles;
}
