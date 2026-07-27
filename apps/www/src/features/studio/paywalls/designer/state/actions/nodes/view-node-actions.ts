import type { Primitive } from "@voidhash/mimic-core";
import type { FlexDirection } from "@voidhash/mimic-schema";
import { ViewNode } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../../designer-commander";
import { selectDocumentRoot } from "../../utils/document-root";
import { findTypedNode } from "../../utils/node-proxies";
import {
  type ViewNodePreviousValues,
  restoreViewNodeData,
  updateViewNodeData,
} from "../../utils/node-data-writes";
import {
  designerInsertViewStyle,
  getFlexDirection,
  isFlexParent,
} from "../../utils/node-type-helpers";
import { normalizeFlexSizing } from "../../utils/normalize-flex-sizing";
import { buildNodeIndex, findParentNode } from "../../utils/tree";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";

type ViewNodeDataPrimitive = Primitive.InferTreeNodeData<typeof ViewNode>;

type ViewNodeUpdates = Primitive.InferUpdateInput<ViewNodeDataPrimitive>;

type ViewNodeInitialValues = NonNullable<Primitive.InferInput<ViewNodeDataPrimitive>>;

/**
 * Get parent flex direction for a node.
 */
function getParentFlexDirection(root: SnapshotNode, nodeId: string): FlexDirection | null {
  const parent = findParentNode<SnapshotNode>(root, nodeId);
  if (!parent) return null;

  return isFlexParent(parent) ? getFlexDirection(parent) : null;
}

export const createViewNode = commander.undoableAction<
  {
    parentId: string;
    beforeSiblingId?: string | null;
    initialValues?: ViewNodeInitialValues;
    /**
     * Seed the DESIGNER click-insert affordance (cross-axis stretch + main-axis
     * min size) so an empty view stays visible under hug-by-default sizing.
     * Resolved from the parent's flex direction. Off for programmatic inserts.
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
        ...(initialValues ?? {}),
        // Caller-supplied style (e.g. flexDirection) wins over the affordance base.
        style: { ...affordance, ...(initialValues?.style ?? {}) },
      };
    }

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }
      try {
        return parent.children.insertLast({ ...(initialValues ?? {}), type: "view" }).id;
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
 * Updates a view node's restorable fields (name, style). Undo restores only
 * the fields the update touched; array fields (`states`, `interactions`,
 * `localVariables`) must go through their dedicated actions — snapshot
 * entries are `{id, pos, value}`-wrapped and cannot replay through `update`.
 */
export const updateViewNode = commander.undoableAction<
  {
    id: string;
    updates: ViewNodeUpdates;
  },
  { previousValues: ViewNodePreviousValues | null }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    const node = findTypedNode(mimic.document.root, params.id, ViewNode);
    if (!node) return { previousValues: null };

    let updates = params.updates;

    // Normalize sizing properties if style updates contain sizing-related properties
    const styleUpdates = updates.style;
    if (
      styleUpdates &&
      ("width" in styleUpdates ||
        "height" in styleUpdates ||
        "flex" in styleUpdates ||
        "alignSelf" in styleUpdates)
    ) {
      const root = selectDocumentRoot(state);
      const parentDirection = getParentFlexDirection(root, params.id);

      const currentStyle = node.get()?.data.style;
      const normalized = normalizeFlexSizing(
        {
          alignSelf: styleUpdates.alignSelf,
          flex: styleUpdates.flex,
          height: styleUpdates.height,
          width: styleUpdates.width,
        },
        {
          alignSelf: currentStyle?.alignSelf,
          flex: currentStyle?.flex,
          height: currentStyle?.height,
          width: currentStyle?.width,
        },
        parentDirection,
      );

      // Normalization only touches flex/alignSelf; `flex: null` means "clear
      // the field" and maps to an explicit-undefined update (field deletion).
      let stylePatch = { ...styleUpdates };
      if (normalized.alignSelf !== undefined) {
        stylePatch = { ...stylePatch, alignSelf: normalized.alignSelf };
      }
      if (normalized.flex !== undefined) {
        stylePatch = {
          ...stylePatch,
          flex: normalized.flex === null ? undefined : normalized.flex,
        };
      }
      updates = { ...updates, style: stylePatch };
    }

    const previousValues = mimic.document.transaction((root) =>
      updateViewNodeData(root, params.id, updates),
    );

    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreViewNodeData(root, params.id, previousValues);
    });
  },
);
