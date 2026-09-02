import type { Primitive } from "@voidhash/mimic-core";
import { ScrollViewNode } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Effect } from "effect";

import { commander } from "../../designer-commander";
import { selectDocumentRoot } from "../../utils/document-root";
import {
  type ScrollViewNodePreviousValues,
  restoreScrollViewNodeData,
  updateScrollViewNodeData,
} from "../../utils/node-data-writes";
import { designerInsertViewStyle, getFlexDirection } from "../../utils/node-type-helpers";
import { findTypedNode } from "../../utils/node-proxies";
import { buildNodeIndex } from "../../utils/tree";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";

type ScrollViewNodeDataPrimitive = Primitive.InferTreeNodeData<typeof ScrollViewNode>;

type ScrollViewNodeInitialValues = NonNullable<Primitive.InferInput<ScrollViewNodeDataPrimitive>>;

type ScrollViewNodeUpdates = Primitive.InferUpdateInput<ScrollViewNodeDataPrimitive>;

/**
 * Creates a `scrollView` node under `parentId`. Mirrors {@link createViewNode}:
 * an optional DESIGNER click-insert affordance seeds cross-axis stretch +
 * main-axis min size (resolved from the parent's flex direction) so an empty
 * scrollView stays visible under hug-by-default sizing.
 */
export const createScrollViewNode = commander.undoableAction<
  {
    parentId: string;
    beforeSiblingId?: string | null;
    initialValues?: ScrollViewNodeInitialValues;
    /**
     * Seed the DESIGNER click-insert affordance (cross-axis stretch + main-axis
     * min size) so an empty scrollView stays visible under hug-by-default
     * sizing. Resolved from the parent's flex direction. Off for programmatic
     * inserts.
     */
    insertAffordance?: boolean;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    let initialValues = params.initialValues;
    if (params.insertAffordance) {
      const root = selectDocumentRoot(state);
      const parentNode = buildNodeIndex<SnapshotNode>(root).get(params.parentId);
      const parentDirection = getFlexDirection(parentNode, "column");
      const affordance = designerInsertViewStyle(parentDirection);
      initialValues = {
        ...initialValues,
        // Caller-supplied style (e.g. flexDirection) wins over the affordance base.
        style: { ...affordance, ...initialValues?.style },
      };
    }

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }
      return Effect.runSync(
        Effect.try(
          () => parent.children.insertLast({ ...initialValues, type: "scrollView" }).id,
        ).pipe(Effect.orElseSucceed((): string | null => null)),
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
 * Updates a scrollView node's restorable fields (`name`, `style`, and the
 * scrollView-only `horizontal`/`showsScrollIndicator` data flags). Undo restores
 * only the fields the update touched. Array fields (`states`, `interactions`,
 * `localVariables`) must go through their dedicated actions — snapshot entries
 * are `{id, pos, value}`-wrapped and cannot replay through `update`. Mirrors the
 * view node update action; the settings panel writes the boolean flags through it.
 */
export const updateScrollViewNode = commander.undoableAction<
  {
    id: string;
    updates: ScrollViewNodeUpdates;
  },
  { previousValues: ScrollViewNodePreviousValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const node = findTypedNode(mimic.document.root, params.id, ScrollViewNode);
    if (!node) return { previousValues: null };

    const previousValues = mimic.document.transaction((root) =>
      updateScrollViewNodeData(root, params.id, params.updates),
    );

    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreScrollViewNodeData(root, params.id, previousValues);
    });
  },
);
