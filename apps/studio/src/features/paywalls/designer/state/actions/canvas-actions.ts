/**
 * Canvas commands using zustand-commander.
 *
 * These commands manage canvas interactions and UI state.
 */

import { commander } from "../designer-commander";
import type { DesignerStoreState } from "../designer-store-state";
import { createFlexNode } from "./nodes/flex-node-actions";
import { createTextNode } from "./nodes/text-node-actions";
import { selectNode, unselectNode } from "./selection-actions";

// =============================================================================
// Helper to get nodes from snapshot as a flat map
// =============================================================================

function getNodesFromSnapshot(
  snapshot: {
    id: string;
    type: string;
    children: unknown[];
  } | null
): Record<string, { id: string; type: string }> {
  if (!snapshot) {
    return {};
  }

  const nodes: Record<string, { id: string; type: string }> = {};

  const traverse = (node: {
    id: string;
    type: string;
    children?: unknown[];
  }): void => {
    nodes[node.id] = node;

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as { id: string; type: string; children?: unknown[] });
      }
    }
  };

  traverse(snapshot);
  return nodes;
}

// =============================================================================
// Canvas State Commands
// =============================================================================

/**
 * Save the current canvas state (scale, position).
 */
export const saveCanvasState = commander.action<{
  scale: number;
  x: number;
  y: number;
}>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    canvas: { ...state.canvas, ...params },
  } as Partial<DesignerStoreState>);
});

/**
 * Update a node's bounding box (used for rendering overlays).
 */
export const updateBoundingBox = commander.action<{
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}>((ctx, params) => {
  const state = ctx.getState();
  const boundingBoxes = { ...state.canvas.boundingBoxes };
  boundingBoxes[params.id] = params.boundingBox;
  ctx.setState({
    canvas: { ...state.canvas, boundingBoxes },
  } as Partial<DesignerStoreState>);
});

// =============================================================================
// Node Hover Commands
// =============================================================================

/**
 * Handle mouse entering a node.
 */
export const nodeMouseEnter = commander.action<{ id: string }>(
  (ctx, params) => {
    const state = ctx.getState();
    if (state.textEditingNodeId) {
      return { shouldPropagate: true };
    }
    ctx.setState({
      highlightedNodeId: params.id,
    } as Partial<DesignerStoreState>);
    return { shouldPropagate: true };
  }
);

/**
 * Handle mouse moving over a node.
 */
export const nodeMouseOver = commander.action<{ id: string }>((ctx, params) => {
  const state = ctx.getState();
  if (state.textEditingNodeId) {
    return { shouldPropagate: true };
  }
  if (!state.highlightedNodeId) {
    ctx.setState({
      highlightedNodeId: params.id,
    } as Partial<DesignerStoreState>);
  }
  return { shouldPropagate: true };
});

/**
 * Handle mouse leaving a node.
 */
export const nodeMouseLeave = commander.action<{ id: string }>(
  (ctx, params) => {
    const state = ctx.getState();
    if (state.textEditingNodeId) {
      return;
    }
    if (state.highlightedNodeId === params.id) {
      ctx.setState({ highlightedNodeId: null } as Partial<DesignerStoreState>);
    }
  }
);

// =============================================================================
// Node Click Commands
// =============================================================================

/**
 * Handle clicking on a node.
 * Behavior depends on the current active tool.
 */
export const nodeClicked = commander.action<{ id: string; shiftKey: boolean }>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;
    const tool = state.tools.activeTool;

    // Get nodes from snapshot
    const nodes = getNodesFromSnapshot(
      mimic.snapshot as {
        id: string;
        type: string;
        children: unknown[];
      } | null
    );

    const clickedNode = nodes[params.id];
    if (!clickedNode) {
      return;
    }

    if (state.textEditingNodeId) {
      return;
    }

    // Get current selection from presence
    const selectedNodeIds = mimic.presence?.self?.selectedNodeIds ?? [];

    switch (tool) {
      case "cursor": {
        const isSelected = selectedNodeIds.includes(params.id);
        if (isSelected) {
          if (params.shiftKey) {
            ctx.dispatch(unselectNode)({ id: params.id });
            return;
          }
          // If the node is already selected, do nothing
          return;
        }
        // Select the node
        ctx.dispatch(selectNode)({ id: params.id, many: params.shiftKey });
        break;
      }

      case "text": {
        ctx.dispatch(createTextNode)({ parentId: params.id });
        break;
      }

      case "columns": {
        ctx.dispatch(createFlexNode)({
          initialValues: {
            name: "Column",
            style: { flexDirection: "column" },
          },
          parentId: params.id,
        });
        break;
      }

      case "rows": {
        ctx.dispatch(createFlexNode)({
          initialValues: { name: "Row", style: { flexDirection: "row" } },
          parentId: params.id,
        });
        break;
      }
    }
  }
);

// =============================================================================
// Text Editing Commands
// =============================================================================

/**
 * Mark that text editing has started on a node.
 */
export const textEditingStarted = commander.action<{ id: string }>(
  (ctx, params) => {
    ctx.setState({
      textEditingNodeId: params.id,
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Mark that text editing has stopped.
 */
export const textEditingStopped = commander.action<{ id: string }>((ctx) => {
  ctx.setState({ textEditingNodeId: null } as Partial<DesignerStoreState>);
});
