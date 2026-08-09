import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface PathFillStyle {
  fillColor: string;
  fillEnabled: boolean;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
}

export const updatePathFillStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<PathFillStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<PathFillStyle>(
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
