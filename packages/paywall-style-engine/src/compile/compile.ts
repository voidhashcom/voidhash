import type { ScreenNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";

import { buildScreenContainerStyles, buildScreenLayoutStyles } from "./screen-styles.ts";
import { buildScrollViewStyles, type ScrollViewOptions } from "./scroll-view-styles.ts";
import { buildShapeContainerStyles } from "./shape-styles.ts";
import { buildTextStyles } from "./text-styles.ts";
import { buildViewStyles, type ViewStyleInput } from "./view-styles.ts";
import { px } from "./utils.ts";

/**
 * Which surface the CSS is lowered for. `runtime` is the deployed paywall
 * (screens fill the viewport); `editor-canvas` is the designer canvas
 * (screens render as fixed device frames with squared corners so the frame
 * chrome owns the rounding). Every target difference is expressed here, in one
 * place, instead of divergent per-surface builder forks.
 */
export type CompileTarget = "runtime" | "editor-canvas";

type ScreenStyle = ScreenNodeData["data"]["style"];

/** The two style records a screen node renders with (outer frame + inner flex layout). */
export interface CompiledScreenStyles {
  readonly container: Properties;
  readonly layout: Properties;
}

/** Lower a screen node's style for a target surface. */
export function compileScreenStyles(style: ScreenStyle, target: CompileTarget): CompiledScreenStyles {
  if (target === "runtime") {
    return {
      container: buildScreenContainerStyles(style),
      layout: buildScreenLayoutStyles(style),
    };
  }

  const container = buildScreenContainerStyles(style);
  container.width = px(style.width);
  container.height = px(style.height);

  // Screens carry no radius fields; the canvas frame chrome owns the rounding.
  const layout = buildViewStyles({
    ...style,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
  });
  layout.width = px(style.width);
  layout.height = px(style.height);

  return { container, layout };
}

/** A box-node compile request, discriminated on node type. */
export type CompileBoxRequest =
  | { readonly nodeType: "view"; readonly style: ViewStyleInput }
  | { readonly nodeType: "text"; readonly style: Parameters<typeof buildTextStyles>[0] }
  | { readonly nodeType: "shape"; readonly style: Parameters<typeof buildShapeContainerStyles>[0] }
  | {
      readonly nodeType: "scrollView";
      readonly style: ViewStyleInput;
      readonly options: ScrollViewOptions;
    };

/**
 * Lower one box node's persisted style to CSS properties. The single lowering
 * shared by the runtime renderer, the designer canvas, and the playground —
 * targets currently agree for box nodes; screens go through
 * {@link compileScreenStyles}.
 */
export function compileBoxStyles(request: CompileBoxRequest, _target: CompileTarget): Properties {
  switch (request.nodeType) {
    case "view":
      return buildViewStyles(request.style);
    case "text":
      return buildTextStyles(request.style);
    case "shape":
      return buildShapeContainerStyles(request.style);
    case "scrollView":
      return buildScrollViewStyles(request.style, request.options);
  }
}
