import type { Primitive } from "@voidhash/mimic-core";
import type { PathNode } from "@voidhash/mimic-schema";
import { Effect } from "effect";

import { commander } from "../../designer-commander";
import {
  type PathNodePreviousValues,
  restorePathNodeData,
  updatePathNodeData,
} from "../../utils/node-data-writes";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";

type PathNodeDataPrimitive = Primitive.InferTreeNodeData<typeof PathNode>;

type PathNodeInitialValues = NonNullable<Primitive.InferInput<PathNodeDataPrimitive>>;

/**
 * Create a path node as a child of a shape node.
 */
export const createPathNode = commander.undoableAction<
  {
    parentId: string;
    beforeSiblingId?: string | null;
    initialValues?: PathNodeInitialValues;
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
      return Effect.runSync(
        Effect.try(() => parent.children.insertLast({ ...params.initialValues, type: "path" }).id).pipe(
          Effect.orElseSucceed((): string | null => null),
        ),
      );
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
 * Updates a path node's restorable fields (name, style, d, transform). Undo
 * restores only the fields the update touched; array fields (`states`,
 * `localVariables`) must go through their dedicated actions — snapshot
 * entries are `{id, pos, value}`-wrapped and cannot replay through `update`.
 */
export const updatePathNode = commander.undoableAction<
  {
    id: string;
    updates: Primitive.InferUpdateInput<PathNodeDataPrimitive>;
  },
  { previousValues: PathNodePreviousValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousValues = mimic.document.transaction((root) =>
      updatePathNodeData(root, params.id, params.updates),
    );
    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restorePathNodeData(root, params.id, previousValues);
    });
  },
);
