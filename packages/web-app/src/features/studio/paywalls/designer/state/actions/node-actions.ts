/**
 * Node commands using zustand-commander.
 *
 * These commands manage node deletion, copy, cut, and paste operations.
 * Uses undoable actions for undo/redo support on delete operations.
 */

import type { Primitive } from "@voidhash/mimic-core";
import { canBeChildOf, isSvgContent } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Effect, Option } from "effect";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import { nodePassesSlotGate } from "../utils/component-children";
import type { DesignerDocumentRoot } from "../utils/node-proxies";
import { canHaveChildrenType } from "../utils/node-type-helpers";
import { selectedNodeIdsFromPresence } from "../utils/presence";
import { unwrapEntriesDeep } from "../utils/replay";
import { buildNodeIndex, findNodeById, findParentNode } from "../utils/tree";
import { getNodePrimitive, isEditableNodeType, type EditableNodeType } from "./node-resolver";
import { createShapeFromSvg } from "./nodes/shape-node-actions";
import { clearSelection, selectNode } from "./selection-actions";

// =============================================================================
// Helper Types
// =============================================================================

interface SerializedNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  children: SerializedNode[];
}

interface ClipboardData {
  __voidhash: true;
  version: 2;
  nodes: SerializedNode[];
  originalParentId: string | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Checks if a node type is a container that can accept children.
 */
function isContainerType(nodeType: string): boolean {
  return canHaveChildrenType(nodeType);
}

function snapshotDataToInput(data: SnapshotNode["data"]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(data)) {
    result[key] = unwrapEntriesDeep(item);
  }
  return result;
}

/**
 * Validates clipboard/undo data against a node type's data schema so it can
 * be passed to `insertLast`/`insertAt` as typed input. Returns false for
 * payloads the schema rejects (including unknown union variants — forward
 * compat lives at the schema-migration layer, not in the clipboard).
 */
function isValidNodeDataInput<TNode extends Primitive.AnyTreeNodePrimitive>(
  node: TNode,
  raw: Record<string, unknown>,
): raw is Record<string, unknown> & NonNullable<Primitive.InferInput<TNode["data"]>> {
  return Effect.runSync(
    Effect.try(() => {
      node.data.encodeOptional(raw);
      return true;
    }).pipe(Effect.orElseSucceed(() => false)),
  );
}

/**
 * Serialize a node and its children for the clipboard / delete-undo payload.
 * Data is stored in plain input shape so restores can replay it directly.
 */
function serializeNode(node: SnapshotNode): SerializedNode {
  return {
    children: node.children.map((child) => serializeNode(child)),
    data: snapshotDataToInput(node.data),
    id: node.id,
    type: node.type,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSerializedNode(value: unknown): value is SerializedNode {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["type"] === "string" &&
    isRecord(value["data"]) &&
    Array.isArray(value["children"]) &&
    value["children"].every((child) => isSerializedNode(child))
  );
}

/**
 * Parse clipboard data from text. Versionless (pre-v2) payloads carry the
 * old flat node shape and are rejected.
 */
function parseClipboardData(text: string): ClipboardData | null {
  // Not valid JSON -> no clipboard payload.
  const decoded = Effect.runSync(
    Effect.try(() => JSON.parse(text) as unknown).pipe(Effect.option),
  );
  if (Option.isNone(decoded)) {
    return null;
  }
  const parsed = decoded.value;
  if (
    isRecord(parsed) &&
    parsed["__voidhash"] === true &&
    parsed["version"] === 2 &&
    Array.isArray(parsed["nodes"]) &&
    parsed["nodes"].every((node) => isSerializedNode(node))
  ) {
    const originalParentId = parsed["originalParentId"];
    return {
      __voidhash: true,
      nodes: parsed["nodes"].filter((node) => isSerializedNode(node)),
      originalParentId: typeof originalParentId === "string" ? originalParentId : null,
      version: 2,
    };
  }
  return null;
}

/**
 * Recursively inserts a serialized subtree under a parent proxy. Nodes whose
 * type is unknown or whose data the schema rejects are skipped (with their
 * subtree). Returns the inserted top-level node id, if any.
 */
function insertSerializedSubtree(
  root: DesignerDocumentRoot,
  parentId: string,
  serialized: SerializedNode,
  index?: number,
): string | null {
  if (!isEditableNodeType(serialized.type)) {
    return null;
  }
  const nodeType: EditableNodeType = serialized.type;
  const primitive = getNodePrimitive(nodeType);
  if (!isValidNodeDataInput(primitive, serialized.data)) {
    return null;
  }
  const parent = root.findByIdAcrossTree(parentId);
  if (parent === undefined) {
    return null;
  }

  const input = { ...serialized.data, type: nodeType };
  const inserted = Effect.runSync(
    Effect.try(() =>
      index === undefined
        ? parent.children.insertLast(input)
        : parent.children.insertAt(index, input),
    ).pipe(Effect.option),
  );
  if (Option.isNone(inserted)) {
    // Failed to insert node (disallowed parent/child combination)
    return null;
  }
  const node = inserted.value;
  for (const child of serialized.children) {
    insertSerializedSubtree(root, node.id, child);
  }
  return node.id;
}

// =============================================================================
// Node Commands
// =============================================================================

/**
 * Delete selected nodes and all their descendants.
 * Undoable: restores the deleted subtrees at their original positions.
 */
export const deleteNodes = commander.undoableAction<
  Record<string, never>,
  {
    deletedNodes: {
      serialized: SerializedNode;
      parentId: string | null;
      index: number;
    }[];
  }
>(
  (ctx) => {
    const state = ctx.getState();
    const { mimic } = state;

    const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);
    if (selectedNodeIds.length === 0) {
      return { deletedNodes: [] };
    }

    const root = selectDocumentRoot(state);
    const deletedNodes: {
      serialized: SerializedNode;
      parentId: string | null;
      index: number;
    }[] = [];

    // Capture state before deletion
    for (const selectedId of selectedNodeIds) {
      const node = findNodeById<SnapshotNode>(root, selectedId);
      if (!node) {
        continue;
      }

      // Prevent deletion of root and screen nodes
      if (node.type === "root" || node.type === "screen") {
        continue;
      }

      const parent = findParentNode<SnapshotNode>(root, selectedId);
      deletedNodes.push({
        index: parent ? parent.children.findIndex((child) => child.id === selectedId) : 0,
        parentId: parent?.id ?? null,
        serialized: serializeNode(node),
      });
    }

    // Perform deletion
    mimic.document.transaction((transactionRoot) => {
      for (const { serialized } of deletedNodes) {
        // Ignore failures — a node that can't be removed is left in place.
        Effect.runSync(
          Effect.try(() => transactionRoot.findByIdAcrossTree(serialized.id)?.remove()).pipe(
            Effect.ignore,
          ),
        );
      }
    });

    // Clear selection after deletion
    ctx.dispatch(clearSelection)({});

    return { deletedNodes };
  },
  (ctx, _params, result) => {
    if (result.deletedNodes.length === 0) {
      return;
    }

    const { mimic } = ctx.getState();

    // Restore deleted subtrees in reverse order to maintain indices
    mimic.document.transaction((root) => {
      for (let i = result.deletedNodes.length - 1; i >= 0; i--) {
        const deleted = result.deletedNodes[i];
        if (deleted?.parentId != null) {
          insertSerializedSubtree(root, deleted.parentId, deleted.serialized, deleted.index);
        }
      }
    });
  },
);

/**
 * Copy selected nodes to clipboard.
 * Non-undoable (read-only operation).
 */
export const copyNodes = commander.action(async (ctx) => {
  const state = ctx.getState();
  const { mimic } = state;

  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);
  if (selectedNodeIds.length === 0) {
    return;
  }

  const root = selectDocumentRoot(state);
  const nodes = buildNodeIndex<SnapshotNode>(root);

  // Filter out root and screen nodes
  const nodeIdsToCopy = selectedNodeIds.filter((id) => {
    const node = nodes.get(id);
    return node && node.type !== "root" && node.type !== "screen";
  });

  if (nodeIdsToCopy.length === 0) {
    return;
  }

  // Serialize nodes
  const serializedNodes: SerializedNode[] = [];
  let originalParentId: string | null = null;

  for (const nodeId of nodeIdsToCopy) {
    const node = nodes.get(nodeId);
    if (node) {
      serializedNodes.push(serializeNode(node));
      // Use the first node's parent as the original parent
      originalParentId ??= findParentNode<SnapshotNode>(root, nodeId)?.id ?? null;
    }
  }

  if (serializedNodes.length === 0) {
    return;
  }

  // Write to clipboard
  const clipboardData: ClipboardData = {
    __voidhash: true,
    nodes: serializedNodes,
    originalParentId,
    version: 2,
  };

  // Ignore failures — the Clipboard API might not be available.
  await Effect.runPromise(
    Effect.tryPromise(() =>
      navigator.clipboard.writeText(JSON.stringify(clipboardData)),
    ).pipe(Effect.ignore),
  );
});

/**
 * Cut selected nodes (copy then delete).
 */
export const cutNodes = commander.action(async (ctx) => {
  // Copy first
  await ctx.dispatch(copyNodes)({});

  // Then delete
  ctx.dispatch(deleteNodes)({});
});

/**
 * Paste nodes from clipboard.
 * Note: This is a regular action (not undoable) since it modifies async state.
 * Use deleteNodes to undo a paste operation.
 */
export const pasteNodes = commander.action(async (ctx) => {
  // Read from clipboard
  const clipboardRead = await Effect.runPromise(
    Effect.tryPromise(() => navigator.clipboard.readText()).pipe(Effect.option),
  );
  if (Option.isNone(clipboardRead)) {
    return;
  }
  const clipboardText = clipboardRead.value;

  // Check if clipboard contains SVG content
  if (isSvgContent(clipboardText)) {
    const state = ctx.getState();
    const { mimic } = state;
    const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);
    const root = selectDocumentRoot(state);
    const nodes = buildNodeIndex<SnapshotNode>(root);

    // Determine paste location for SVG
    let targetParentId: string | null = null;

    if (selectedNodeIds.length > 0) {
      const firstSelectedId = selectedNodeIds[0];
      if (firstSelectedId) {
        const selectedNode = nodes.get(firstSelectedId);
        if (
          selectedNode &&
          isContainerType(selectedNode.type) &&
          selectedNode.type !== "root" &&
          selectedNode.type !== "shape" // Can't paste SVG into a shape
        ) {
          targetParentId = firstSelectedId;
        }
      }
    }

    // If no valid target, find the first screen
    if (targetParentId === null) {
      const findFirstScreen = (node: SnapshotNode): string | null => {
        if (node.type === "screen") return node.id;
        for (const child of node.children) {
          const found = findFirstScreen(child);
          if (found) return found;
        }
        return null;
      };
      targetParentId = findFirstScreen(root);
    }

    if (targetParentId) {
      ctx.dispatch(createShapeFromSvg)({
        parentId: targetParentId,
        svgSource: clipboardText,
      });
    }
    return;
  }

  // Parse clipboard data
  const clipboardData = parseClipboardData(clipboardText);
  if (!clipboardData || clipboardData.nodes.length === 0) {
    return;
  }

  const state = ctx.getState();
  const { mimic } = state;
  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);
  const root = selectDocumentRoot(state);
  const nodes = buildNodeIndex<SnapshotNode>(root);

  // Get the types of root-level nodes being pasted
  const pastedRootTypes = clipboardData.nodes.map((node) => node.type);
  const componentCatalogByHash = state.componentCatalog.byContentHash;

  // Helper to check if all pasted nodes can be children of a parent node
  // (catalog rules + the component manifest slot gate).
  const canPasteInto = (parent: SnapshotNode): boolean => {
    return (
      pastedRootTypes.every((childType) => canBeChildOf(childType, parent.type)) &&
      nodePassesSlotGate(parent, componentCatalogByHash)
    );
  };

  // Determine paste location (smart paste)
  let targetParentId: string | null = null;

  if (selectedNodeIds.length > 0) {
    const firstSelectedId = selectedNodeIds[0];
    if (firstSelectedId) {
      const selectedNode = nodes.get(firstSelectedId);

      if (
        selectedNode &&
        isContainerType(selectedNode.type) &&
        selectedNode.type !== "root" &&
        canPasteInto(selectedNode)
      ) {
        // Paste as child of selected container (only if valid)
        targetParentId = firstSelectedId;
      } else if (clipboardData.originalParentId) {
        // Paste at original parent
        targetParentId = clipboardData.originalParentId;
      } else if (selectedNode) {
        // Paste as sibling of selected node
        targetParentId = findParentNode<SnapshotNode>(root, firstSelectedId)?.id ?? null;
      }
    }
  } else if (clipboardData.originalParentId) {
    // No selection, paste at original parent
    targetParentId = clipboardData.originalParentId;
  }

  // Verify target parent exists and can accept the pasted nodes
  if (targetParentId === null || !nodes.has(targetParentId)) {
    return;
  }

  const targetNode = nodes.get(targetParentId);
  if (targetNode && !canPasteInto(targetNode)) {
    // Target can't accept these node types, try to find original parent
    if (clipboardData.originalParentId && nodes.has(clipboardData.originalParentId)) {
      const origParent = nodes.get(clipboardData.originalParentId);
      if (origParent && canPasteInto(origParent)) {
        targetParentId = clipboardData.originalParentId;
      } else {
        return; // Can't find valid paste target
      }
    } else {
      return; // Can't find valid paste target
    }
  }

  const finalTargetParentId = targetParentId;
  const pastedNodeIds: string[] = [];

  // Insert whole subtrees in one transaction; fresh ids are generated by the
  // engine on every insert.
  mimic.document.transaction((transactionRoot) => {
    for (const serialized of clipboardData.nodes) {
      const insertedId = insertSerializedSubtree(transactionRoot, finalTargetParentId, serialized);
      if (insertedId !== null) {
        pastedNodeIds.push(insertedId);
      }
    }
  });

  // Select newly pasted nodes
  if (pastedNodeIds.length > 0) {
    ctx.dispatch(clearSelection)({});
    const firstPastedId = pastedNodeIds[0];
    if (firstPastedId) {
      ctx.dispatch(selectNode)({ id: firstPastedId, many: false });
    }

    for (let i = 1; i < pastedNodeIds.length; i++) {
      const pastedId = pastedNodeIds[i];
      if (pastedId) {
        ctx.dispatch(selectNode)({ id: pastedId, many: true });
      }
    }
  }
});
