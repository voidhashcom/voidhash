import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface PathStrokeStyle {
  strokeColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
  strokeOpacity: number;
}

export const updatePathStrokeStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<PathStrokeStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<PathStrokeStyle>(
      ctx.getState().mimic,
      params.nodes,
      params.style,
      ctx.getState().stateOverrideSelection,
      ctx.transaction,
    ),
  }),
  (ctx, params, result) => {
    undoStyleUpdate(ctx.getState().mimic, params.nodes, result.previousStyles, ctx.transaction);
  },
);
