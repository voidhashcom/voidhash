import { commander } from "../../designer-commander";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

export type BackgroundType = "solid" | "gradient" | "image";

/** Logical gradient-stop write shape (the CRDT wraps these on read). */
export interface GradientStop {
  color: string;
  position: number;
}

export interface BackgroundGradient {
  kind: "linear" | "radial";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  stops: GradientStop[];
}

export interface BackgroundImage {
  url: string;
  resizeMode: "cover" | "contain" | "stretch" | "center";
}

interface FillStyle {
  backgroundColor: string;
  backgroundEnabled: boolean;
  backgroundType: BackgroundType;
  backgroundGradient: BackgroundGradient;
  backgroundImage: BackgroundImage;
}

export const updateFillStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<FillStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => ({
    previousStyles: applyStyleUpdate<FillStyle>(
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
