import type { FontWeight, TextAlign } from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface TypographyStyle {
  fontSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  color: string;
}

export const updateTypographyStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<TypographyStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<TypographyStyle>(
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
