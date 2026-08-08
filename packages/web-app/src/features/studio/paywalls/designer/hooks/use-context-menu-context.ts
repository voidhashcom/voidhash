"use client";

/**
 * Hook to build ContextMenuContext from current state.
 *
 * This hook provides the context needed for context menu action
 * visibility and enablement decisions.
 */

import { useCallback } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";
import { isEditableNodeType } from "@voidhash/mimic-schema";

import type {
  ClickContext,
  ContextMenuContext,
  ContextSource,
  NodeType,
  SelectionContext,
} from "../state/context-menu/types";
import { usePaywallDesignerStore } from "../state/designer-store";
import type { ComponentCatalogByContentHash } from "../state/designer-store-state";
import { selectDocumentRoot } from "../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import type { SnapshotNode } from "../state/utils/selection-level";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get node type from snapshot by ID.
 */
function getNodeTypeById(snapshot: SnapshotNode | null, nodeId: string): NodeType | null {
  if (!snapshot) {
    return null;
  }

  const findNode = (node: SnapshotNode): SnapshotNode | null => {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const node = findNode(snapshot);
  if (!node) {
    return null;
  }

  return isEditableNodeType(node.type) ? node.type : null;
}

/**
 * Get types for a list of node IDs.
 */
function getNodeTypes(snapshot: SnapshotNode | null, nodeIds: string[]): NodeType[] {
  return nodeIds
    .map((id) => getNodeTypeById(snapshot, id))
    .filter((type): type is NodeType => type !== null);
}

/**
 * Check if all types in the array are the same.
 */
function areTypesHomogeneous(types: NodeType[]): boolean {
  if (types.length <= 1) {
    return true;
  }
  const firstType = types[0];
  return types.every((type) => type === firstType);
}

// =============================================================================
// Hook
// =============================================================================

export interface BuildContextParams {
  /** Where the context menu was triggered */
  source: ContextSource;
  /** ID of the clicked node (null for background) */
  clickedNodeId?: string | null;
  /** Canvas coordinates (null for layers panel) */
  canvasPosition?: { x: number; y: number } | null;
}

export interface UseContextMenuContextResult {
  /** Build a context from click/trigger params */
  buildContext: (params: BuildContextParams) => ContextMenuContext;
  /** Get current selection context (for non-click operations) */
  getSelectionContext: () => SelectionContext;
}

/**
 * Hook to build ContextMenuContext for context menu operations.
 */
export function useContextMenuContext(): UseContextMenuContextResult {
  const store = usePaywallDesignerStore();
  const snapshot: SnapshotNode = useStore(store, selectDocumentRoot);
  const selectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );
  const textEditingNodeId = useStore(
    store,
    useShallow((state) => state.textEditingNodeId),
  );
  const componentCatalogByContentHash = useStore(
    store,
    (state) => state.componentCatalog.byContentHash,
  );

  const getSelectionContext = useCallback((): SelectionContext => {
    const nodeIds = [...selectedNodeIds];
    const selectedNodeTypes = getNodeTypes(snapshot, nodeIds);

    return {
      selectedNodeIds: nodeIds,
      selectedNodeTypes,
      isHomogeneousSelection: areTypesHomogeneous(selectedNodeTypes),
      isTextEditing: textEditingNodeId !== null,
    };
  }, [snapshot, selectedNodeIds, textEditingNodeId]);

  const buildContext = useCallback(
    (params: BuildContextParams): ContextMenuContext => {
      const { source, clickedNodeId = null, canvasPosition = null } = params;

      const selection = getSelectionContext();

      // Determine click context
      const clickedNodeType = clickedNodeId ? getNodeTypeById(snapshot, clickedNodeId) : null;

      // Check if clicked inside selection
      const clickedInsideSelection =
        clickedNodeId !== null && selectedNodeIds.includes(clickedNodeId);

      const click: ClickContext = {
        source,
        clickedNodeId,
        clickedNodeType,
        clickedInsideSelection,
        canvasPosition,
      };

      return {
        selection,
        click,
        snapshot,
        componentCatalogByContentHash,
      };
    },
    [snapshot, selectedNodeIds, getSelectionContext, componentCatalogByContentHash],
  );

  return {
    buildContext,
    getSelectionContext,
  };
}

/**
 * Build a context for keyboard shortcuts (no click info needed).
 */
export function buildKeyboardContext(
  snapshot: SnapshotNode | null,
  selectedNodeIds: readonly string[],
  textEditingNodeId: string | null,
  componentCatalogByContentHash: ComponentCatalogByContentHash,
): ContextMenuContext {
  const nodeIds = [...selectedNodeIds];
  const selectedNodeTypes = getNodeTypes(snapshot, nodeIds);

  const selection: SelectionContext = {
    selectedNodeIds: nodeIds,
    selectedNodeTypes,
    isHomogeneousSelection: areTypesHomogeneous(selectedNodeTypes),
    isTextEditing: textEditingNodeId !== null,
  };

  const click: ClickContext = {
    source: "canvas",
    clickedNodeId: null,
    clickedNodeType: null,
    clickedInsideSelection: false,
    canvasPosition: null,
  };

  return {
    selection,
    click,
    snapshot,
    componentCatalogByContentHash,
  };
}
