import type { Primitive } from "@voidhash/mimic-core";
import type { ScreenNode } from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import {
  type ScreenNodePreviousValues,
  restoreScreenNodeData,
  updateScreenNodeData,
} from "../../utils/node-data-writes";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";

type ScreenNodeDataPrimitive = Primitive.InferTreeNodeData<typeof ScreenNode>;

type ScreenNodeInitialValues = NonNullable<Primitive.InferInput<ScreenNodeDataPrimitive>>;

export const createScreenNode = commander.undoableAction<
  {
    parentId: string;
    beforeSiblingId?: string | null;
    initialValues?: ScreenNodeInitialValues;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }
      try {
        return parent.children.insertLast({ ...(params.initialValues ?? {}), type: "screen" }).id;
      } catch {
        return null;
      }
    });

    if (newNodeId) {
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
      ctx.dispatch(setActiveTool)({ tool: "cursor" });
    }

    return { nodeId: newNodeId };
  },
  (ctx, _params, result) => {
    if (result.nodeId === null) return;

    const { mimic } = ctx.getState();
    const { nodeId } = result;
    mimic.document.transaction((root) => {
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Updates a screen node's restorable fields (name, style). Undo restores only
 * the fields the update touched; array fields (`states`, `localVariables`)
 * must go through their dedicated actions — snapshot entries are
 * `{id, pos, value}`-wrapped and cannot replay through `update`.
 */
export const updateScreenNode = commander.undoableAction<
  {
    id: string;
    updates: Primitive.InferUpdateInput<ScreenNodeDataPrimitive>;
  },
  { previousValues: ScreenNodePreviousValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousValues = mimic.document.transaction((root) =>
      updateScreenNodeData(root, params.id, params.updates),
    );
    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreScreenNodeData(root, params.id, previousValues);
    });
  },
);
