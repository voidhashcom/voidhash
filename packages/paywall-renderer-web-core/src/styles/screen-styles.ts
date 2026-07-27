import type { ScreenNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { buildBackgroundStyles } from "./background";
import { px } from "./utils";

export function buildScreenContainerStyles(style: ScreenNodeData["data"]["style"]): Properties {
  const styles: Properties = {
    boxSizing: "border-box",
    height: "100vh",
    overflow: "hidden",
    width: "100vw",
  };

  Object.assign(styles, buildBackgroundStyles(style));

  return styles;
}

export function buildScreenLayoutStyles(style: ScreenNodeData["data"]["style"]): Properties {
  return {
    alignItems: style.alignItems,
    display: style.display,
    flexDirection: style.flexDirection,
    gap: px(style.gap ?? 0),
    height: "100vh",
    justifyContent: style.justifyContent,
    paddingBottom: px(style.paddingBottom ?? 0),
    paddingLeft: px(style.paddingLeft ?? 0),
    paddingRight: px(style.paddingRight ?? 0),
    paddingTop: px(style.paddingTop ?? 0),
    width: "100vw",
  };
}
