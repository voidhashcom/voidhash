import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface TextFillStyle {
  color: string;
}

export const updateTextFillStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<TextFillStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<TextFillStyle>(
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
