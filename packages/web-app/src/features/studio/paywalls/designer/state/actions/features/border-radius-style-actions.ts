import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface BorderRadiusStyle {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
}

export const updateBorderRadiusStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<BorderRadiusStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<BorderRadiusStyle>(
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
