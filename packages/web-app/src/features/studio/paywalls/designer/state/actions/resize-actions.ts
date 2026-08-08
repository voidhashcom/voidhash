/**
 * Resize (transform handles) commands using zustand-commander.
 *
 * These commands manage resizing nodes via corner/edge handles.
 * Uses undoable actions for undo/redo support.
 */

import type { FlexDirection } from "@voidhash/mimic-schema";
import { ScreenNode, ScrollViewNode, ShapeNode, ViewNode } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import type { ResizeHandle, ResizeState } from "../designer-store-state";
import type { BoundingBox, Point } from "../utils/bounding-box";
import { calculateCombinedBoundingBox } from "../utils/bounding-box";
import { findTypedNode, type DesignerDocumentRoot } from "../utils/node-proxies";
import { getFlexDirection, isFlexParent } from "../utils/node-type-helpers";
import { normalizeFlexSizing } from "../utils/normalize-flex-sizing";
import { selectedNodeIdsFromPresence } from "../utils/presence";
import {
  getSelectedStateIdForNode,
  getStateById,
  isStateCapableNode,
  mapStyleOverridesForSnapshot,
  resolveEffectiveStyle,
  stateStyleOverridesToRecord,
  type StyleOverrideRecord,
} from "../utils/state-overrides";
import { findNodeById, findParentNode, flattenTree } from "../utils/tree";

// =============================================================================
// Constants
// =============================================================================

const CORNER_HANDLES = new Set<ResizeHandle>(["nw", "ne", "sw", "se"]);
const HORIZONTAL_EDGE_HANDLES = new Set<ResizeHandle>(["e", "w"]);
const VERTICAL_EDGE_HANDLES = new Set<ResizeHandle>(["n", "s"]);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract node types from the snapshot tree.
 */
function getNodeTypesFromSnapshot(root: SnapshotNode): Record<string, string> {
  const types: Record<string, string> = {};
  for (const node of flattenTree(root)) {
    types[node.id] = node.type;
  }
  return types;
}

/**
 * Calculate new bounds based on handle being dragged.
 */
function calculateNewBounds(
  handle: ResizeHandle,
  initialBounds: BoundingBox,
  startPoint: Point,
  currentPoint: Point,
): BoundingBox {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;

  let { x, y, width, height } = initialBounds;

  switch (handle) {
    case "nw":
      x = initialBounds.x + deltaX;
      y = initialBounds.y + deltaY;
      width = initialBounds.width - deltaX;
      height = initialBounds.height - deltaY;
      break;
    case "n":
      y = initialBounds.y + deltaY;
      height = initialBounds.height - deltaY;
      break;
    case "ne":
      y = initialBounds.y + deltaY;
      width = initialBounds.width + deltaX;
      height = initialBounds.height - deltaY;
      break;
    case "e":
      width = initialBounds.width + deltaX;
      break;
    case "se":
      width = initialBounds.width + deltaX;
      height = initialBounds.height + deltaY;
      break;
    case "s":
      height = initialBounds.height + deltaY;
      break;
    case "sw":
      x = initialBounds.x + deltaX;
      width = initialBounds.width - deltaX;
      height = initialBounds.height + deltaY;
      break;
    case "w":
      x = initialBounds.x + deltaX;
      width = initialBounds.width - deltaX;
      break;
  }

  // Clamp to minimum size
  width = Math.max(1, width);
  height = Math.max(1, height);

  return { height, width, x, y };
}

/** Reads a style value as the stored size shape (`"auto"` = hug contents). */
function sizeFromStyleValue(value: unknown): number | "auto" {
  return typeof value === "number" ? value : "auto";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function flexFromStyleValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function alignSelfFromStyleValue(value: unknown): string {
  return typeof value === "string" ? value : "auto";
}

type AlignSelfValue = "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";

function asAlignSelf(value: string | undefined): AlignSelfValue | undefined {
  switch (value) {
    case "auto":
    case "flex-start":
    case "center":
    case "flex-end":
    case "stretch":
    case "baseline":
      return value;
    default:
      return undefined;
  }
}

/**
 * Bivariant structural view of the per-state overrides proxy, so generic
 * string-keyed override writes typecheck against the schema-typed proxies.
 */
interface StateOverridesProxy {
  overrides: {
    style: {
      set(value: Record<string, unknown>): void;
      update(value: Record<string, unknown>): void;
    };
  };
}

function resolveStateOverridesProxy(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: "screen" | "view" | "scrollView" | "shape",
  stateId: string,
): StateOverridesProxy | undefined {
  switch (nodeType) {
    case "screen":
      return findTypedNode(root, nodeId, ScreenNode)?.data.states.findById(stateId)?.value;
    case "view":
      return findTypedNode(root, nodeId, ViewNode)?.data.states.findById(stateId)?.value;
    case "scrollView":
      return findTypedNode(root, nodeId, ScrollViewNode)?.data.states.findById(stateId)?.value;
    case "shape":
      return findTypedNode(root, nodeId, ShapeNode)?.data.states.findById(stateId)?.value;
  }
}

/**
 * Bivariant structural view of the flex-sizing style proxy shared by `view` and
 * `scrollView` nodes (identical style schemas). Lets the resize writes target
 * either node type through one code path (mirrors the seam in `move-actions`).
 */
interface ViewLikeStyleProxy {
  data: {
    style: {
      width: { get(): unknown; set(value: number | "auto"): void };
      height: { get(): unknown; set(value: number | "auto"): void };
      flex: { get(): unknown; set(value: number): void };
      alignSelf: { get(): unknown; set(value: AlignSelfValue): void };
      update(value: Record<string, unknown>): void;
    };
  };
}

/**
 * Resolves a `view`/`scrollView` node to its flex-sizing style proxy. Both carry
 * the identical style schema, so the resize path writes to either uniformly.
 */
function resolveViewLikeProxy(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: "view" | "scrollView",
): ViewLikeStyleProxy | undefined {
  const proxy =
    nodeType === "view"
      ? findTypedNode(root, nodeId, ViewNode)
      : findTypedNode(root, nodeId, ScrollViewNode);
  return proxy as ViewLikeStyleProxy | undefined;
}

function upsertStateStyleOverride(
  stateProxy: StateOverridesProxy,
  key: string,
  value: unknown,
): void {
  stateProxy.overrides.style.update({
    [key]: value,
  });
}

function removeStateStyleOverride(stateProxy: StateOverridesProxy, key: string): void {
  stateProxy.overrides.style.update({
    [key]: undefined,
  });
}

/**
 * Get parent flex direction for a node.
 */
function getParentFlexDirection(root: SnapshotNode, nodeId: string): FlexDirection | null {
  const parent = findParentNode<SnapshotNode>(root, nodeId);
  if (!parent) return null;

  return isFlexParent(parent) ? getFlexDirection(parent) : null;
}

// =============================================================================
// Resize Commands
// =============================================================================

/**
 * Start resize operation.
 * Captures initial state for all selected nodes.
 * For nodes in hug/fill mode, uses computed dimensions from bounding boxes
 * to automatically switch to fixed mode.
 */
export const startResize = commander.action<{
  handle: ResizeHandle;
  screenPoint: Point;
}>((ctx, params) => {
  const state = ctx.getState();
  const { canvas, mimic } = state;
  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);

  if (selectedNodeIds.length === 0) {
    return;
  }

  // Calculate combined bounding box
  const combinedBounds = calculateCombinedBoundingBox([...selectedNodeIds], canvas.boundingBoxes);
  if (!combinedBounds) {
    return;
  }

  const root = selectDocumentRoot(state);
  const nodeTypes = getNodeTypesFromSnapshot(root);

  // Capture initial dimensions for resize calculations
  const initialNodeDimensions: ResizeState["initialNodeDimensions"] = {};
  // Capture original document state for undo (includes flex/alignSelf)
  const originalDocumentState: ResizeState["originalDocumentState"] = {};
  const stateOverrideTargets: ResizeState["stateOverrideTargets"] = {};
  const originalStateOverrideStyles: ResizeState["originalStateOverrideStyles"] = {};

  for (const nodeId of selectedNodeIds) {
    const nodeType = nodeTypes[nodeId];

    if (!nodeType) {
      continue;
    }

    // Skip text nodes (no explicit dimensions)
    if (nodeType === "text") {
      continue;
    }

    // Get computed dimensions from bounding box for nodes in hug/fill mode
    const boundingBox = canvas.boundingBoxes[nodeId];
    const computedWidth = boundingBox ? Math.round(boundingBox.width) : null;
    const computedHeight = boundingBox ? Math.round(boundingBox.height) : null;
    const snapshotNode = findNodeById<SnapshotNode>(root, nodeId);
    const selectedStateId =
      snapshotNode && isStateCapableNode(snapshotNode)
        ? getSelectedStateIdForNode(state.stateOverrideSelection, nodeId)
        : null;
    const selectedState =
      snapshotNode && isStateCapableNode(snapshotNode)
        ? getStateById(snapshotNode, selectedStateId)
        : null;
    if (selectedState && selectedStateId) {
      stateOverrideTargets[nodeId] = selectedStateId;
      originalStateOverrideStyles[nodeId] = mapStyleOverridesForSnapshot(
        stateStyleOverridesToRecord(selectedState),
      );
    }

    // Get the effective style (selected state override applied) for the node
    if (nodeType === "screen" && snapshotNode?.type === "screen") {
      const style = resolveEffectiveStyle(snapshotNode, selectedStateId);
      initialNodeDimensions[nodeId] = {
        height: numberOrNull(style["height"]) ?? computedHeight,
        type: "screen",
        width: numberOrNull(style["width"]) ?? computedWidth,
      };
      originalDocumentState[nodeId] = {
        width: sizeFromStyleValue(style["width"]),
        height: sizeFromStyleValue(style["height"]),
        flex: undefined,
        alignSelf: "auto",
        type: "screen",
      };
    } else if (
      (nodeType === "view" || nodeType === "scrollView") &&
      (snapshotNode?.type === "view" || snapshotNode?.type === "scrollView")
    ) {
      const style = resolveEffectiveStyle(snapshotNode, selectedStateId);
      // Use stored dimensions if explicit, otherwise use computed dimensions.
      // This enables resizing nodes in hug/fill mode by auto-switching to fixed.
      const width = numberOrNull(style["width"]) ?? computedWidth;
      const height = numberOrNull(style["height"]) ?? computedHeight;

      // Include flex nodes if we have any dimension (explicit or computed)
      if (width !== null || height !== null) {
        initialNodeDimensions[nodeId] = {
          height,
          type: snapshotNode.type,
          width,
        };
      }

      // Always capture original document state for undo
      originalDocumentState[nodeId] = {
        width: sizeFromStyleValue(style["width"]),
        height: sizeFromStyleValue(style["height"]),
        flex: flexFromStyleValue(style["flex"]),
        alignSelf: alignSelfFromStyleValue(style["alignSelf"]),
        type: snapshotNode.type,
      };
    } else if (nodeType === "shape" && snapshotNode?.type === "shape") {
      const style = snapshotNode.data.style;
      const width = numberOrNull(style.width) ?? computedWidth;
      const height = numberOrNull(style.height) ?? computedHeight;

      if (width !== null || height !== null) {
        initialNodeDimensions[nodeId] = {
          height,
          type: "shape",
          width,
        };
      }

      originalDocumentState[nodeId] = {
        width: style.width,
        height: style.height,
        flex: style.flex,
        alignSelf: style.alignSelf,
        type: "shape",
      };
    }
  }

  ctx.setState({
    highlightedNodeId: null,
    resize: {
      currentNodeDimensions: {},
      handle: params.handle,
      initialCombinedBounds: combinedBounds,
      initialNodeDimensions,
      originalStateOverrideStyles,
      originalDocumentState,
      stateOverrideTargets,
      isActive: true,
      startScreenPoint: params.screenPoint,
    },
  });
});

/**
 * Update resize during mouse move.
 * Calculates and applies new dimensions to all affected nodes.
 * Uses ctx.transaction for draft-aware updates that don't sync to server during drag.
 */
export const updateResize = commander.undoableAction<
  { screenPoint: Point; maintainAspectRatio: boolean },
  Record<string, never>
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { canvas, resize } = state;

    if (
      !resize.isActive ||
      !resize.handle ||
      !resize.initialCombinedBounds ||
      !resize.startScreenPoint
    ) {
      return {};
    }

    // Convert screen delta to canvas delta (account for zoom)
    const deltaScreenX = params.screenPoint.x - resize.startScreenPoint.x;
    const deltaScreenY = params.screenPoint.y - resize.startScreenPoint.y;
    const deltaCanvasX = deltaScreenX / canvas.scale;
    const deltaCanvasY = deltaScreenY / canvas.scale;

    // Calculate new combined bounds in canvas coordinates
    const initial = resize.initialCombinedBounds;
    const newBounds = calculateNewBounds(
      resize.handle,
      initial,
      { x: 0, y: 0 },
      { x: deltaCanvasX, y: deltaCanvasY },
    );

    let scaleX = newBounds.width / initial.width;
    let scaleY = newBounds.height / initial.height;

    // Determine which dimensions to scale based on handle type
    const isCornerHandle = CORNER_HANDLES.has(resize.handle);
    const isHorizontalEdge = HORIZONTAL_EDGE_HANDLES.has(resize.handle);
    const isVerticalEdge = VERTICAL_EDGE_HANDLES.has(resize.handle);

    if (params.maintainAspectRatio) {
      const hasValidInitialBounds =
        initial.width > 0 &&
        initial.height > 0 &&
        Number.isFinite(initial.width) &&
        Number.isFinite(initial.height);

      if (hasValidInitialBounds) {
        const normalizedDeltaX = Math.abs(deltaCanvasX / initial.width);
        const normalizedDeltaY = Math.abs(deltaCanvasY / initial.height);
        const widthScale = scaleX;
        const heightScale = scaleY;

        let uniformScale = widthScale;
        if (isVerticalEdge) {
          uniformScale = heightScale;
        } else if (isCornerHandle) {
          uniformScale = normalizedDeltaX >= normalizedDeltaY ? widthScale : heightScale;
        }

        if (Number.isFinite(uniformScale) && uniformScale > 0) {
          scaleX = uniformScale;
          scaleY = uniformScale;
        }
      }
    }

    const root = selectDocumentRoot(state);

    // Compute new dimensions
    const currentNodeDimensions: ResizeState["currentNodeDimensions"] = {};

    for (const [nodeId, dims] of Object.entries(resize.initialNodeDimensions)) {
      let newWidth = dims.width;
      let newHeight = dims.height;

      const shouldScaleWidth = params.maintainAspectRatio || isCornerHandle || isHorizontalEdge;
      const shouldScaleHeight = params.maintainAspectRatio || isCornerHandle || isVerticalEdge;

      if (dims.width !== null && shouldScaleWidth) {
        newWidth = Math.max(1, Math.round(dims.width * scaleX));
      }
      if (dims.height !== null && shouldScaleHeight) {
        newHeight = Math.max(1, Math.round(dims.height * scaleY));
      }

      currentNodeDimensions[nodeId] = {
        height: newHeight,
        type: dims.type,
        width: newWidth,
      };
    }

    // Apply changes using ctx.transaction for draft-aware updates
    // This prevents syncing to server during drag (batched until commit)
    ctx.transaction((transactionRoot) => {
      for (const [nodeId, dims] of Object.entries(currentNodeDimensions)) {
        const stateId = resize.stateOverrideTargets[nodeId];
        if (dims.type === "screen") {
          const proxy = findTypedNode(transactionRoot, nodeId, ScreenNode);
          if (proxy) {
            if (stateId) {
              const stateProxy = resolveStateOverridesProxy(
                transactionRoot,
                nodeId,
                "screen",
                stateId,
              );
              if (!stateProxy) {
                continue;
              }
              if (dims.width !== null) {
                const baseWidth = proxy.data.style.width.get();
                if (dims.width === baseWidth) {
                  removeStateStyleOverride(stateProxy, "width");
                } else {
                  upsertStateStyleOverride(stateProxy, "width", dims.width);
                }
              }
              if (dims.height !== null) {
                const baseHeight = proxy.data.style.height.get();
                if (dims.height === baseHeight) {
                  removeStateStyleOverride(stateProxy, "height");
                } else {
                  upsertStateStyleOverride(stateProxy, "height", dims.height);
                }
              }
              continue;
            }
            if (dims.width !== null) {
              proxy.data.style.width.set(dims.width);
            }
            if (dims.height !== null) {
              proxy.data.style.height.set(dims.height);
            }
          }
        } else if (dims.type === "view" || dims.type === "scrollView") {
          const proxy = resolveViewLikeProxy(transactionRoot, nodeId, dims.type);
          if (proxy) {
            const originalState = resize.originalDocumentState[nodeId];
            const parentDirection = getParentFlexDirection(root, nodeId);

            // Normalize sizing to clear fill indicators when setting explicit dimensions
            // This ensures the preview shows correctly (fill indicators override explicit dimensions)
            const normalized = normalizeFlexSizing(
              {
                width: dims.width,
                height: dims.height,
              },
              {
                width: originalState?.width ?? null,
                height: originalState?.height ?? null,
                flex: originalState?.flex ?? null,
                alignSelf: asAlignSelf(originalState?.alignSelf),
              },
              parentDirection,
            );

            if (stateId) {
              const stateProxy = resolveStateOverridesProxy(
                transactionRoot,
                nodeId,
                dims.type,
                stateId,
              );
              if (!stateProxy) {
                continue;
              }
              if (dims.width !== null) {
                const baseWidth = proxy.data.style.width.get();
                if (dims.width === baseWidth) {
                  removeStateStyleOverride(stateProxy, "width");
                } else {
                  upsertStateStyleOverride(stateProxy, "width", dims.width);
                }
              }
              if (dims.height !== null) {
                const baseHeight = proxy.data.style.height.get();
                if (dims.height === baseHeight) {
                  removeStateStyleOverride(stateProxy, "height");
                } else {
                  upsertStateStyleOverride(stateProxy, "height", dims.height);
                }
              }
              if (normalized.flex !== undefined) {
                const baseFlex = proxy.data.style.flex.get();
                if (normalized.flex === null || normalized.flex === baseFlex) {
                  // "Clear flex" overrides cannot be expressed — inherit the base.
                  removeStateStyleOverride(stateProxy, "flex");
                } else {
                  upsertStateStyleOverride(stateProxy, "flex", normalized.flex);
                }
              }
              if (normalized.alignSelf !== undefined) {
                const baseAlignSelf = proxy.data.style.alignSelf.get();
                if (normalized.alignSelf === baseAlignSelf) {
                  removeStateStyleOverride(stateProxy, "alignSelf");
                } else {
                  upsertStateStyleOverride(stateProxy, "alignSelf", normalized.alignSelf);
                }
              }
              continue;
            }

            if (dims.width !== null) {
              proxy.data.style.width.set(dims.width);
            }
            if (dims.height !== null) {
              proxy.data.style.height.set(dims.height);
            }
            // Apply normalization: clear fill indicators if needed
            // This is critical for the preview to work correctly
            if (normalized.flex !== undefined) {
              if (normalized.flex === null) {
                proxy.data.style.update({ flex: undefined });
              } else {
                proxy.data.style.flex.set(normalized.flex);
              }
            }
            if (normalized.alignSelf !== undefined) {
              proxy.data.style.alignSelf.set(normalized.alignSelf);
            }
          }
        } else if (dims.type === "shape") {
          const proxy = findTypedNode(transactionRoot, nodeId, ShapeNode);
          if (proxy) {
            if (dims.width !== null) {
              proxy.data.style.width.set(dims.width);
            }
            if (dims.height !== null) {
              proxy.data.style.height.set(dims.height);
            }
          }
        }
      }
    });

    ctx.setState({
      resize: {
        ...resize,
        currentNodeDimensions,
      },
    });

    return {};
  },
  // Undo is handled by endResize, not individual updateResize calls
  () => {},
);

/**
 * End resize and commit changes.
 * This is undoable - stores previous dimensions for all affected nodes.
 * Applies normalization to clear fill indicators when setting explicit dimensions.
 */
export const endResize = commander.undoableAction<
  Record<string, never>,
  {
    previousState: ResizeState["originalDocumentState"];
    previousStateOverrides: Record<string, StyleOverrideRecord>;
    stateOverrideTargets: Record<string, string>;
    finalDimensions: ResizeState["currentNodeDimensions"];
  }
>(
  (ctx) => {
    const state = ctx.getState();
    const { mimic, resize } = state;

    if (!resize.isActive) {
      ctx.setState({
        resize: {
          currentNodeDimensions: {},
          handle: null,
          initialCombinedBounds: null,
          initialNodeDimensions: {},
          originalStateOverrideStyles: {},
          originalDocumentState: {},
          stateOverrideTargets: {},
          isActive: false,
          startScreenPoint: null,
        },
      });
      return {
        finalDimensions: {},
        previousState: {},
        previousStateOverrides: {},
        stateOverrideTargets: {},
      };
    }

    // Capture final dimensions from local state
    const finalDimensions = { ...resize.currentNodeDimensions };

    // Use original document state captured at startResize for undo
    const previousState = { ...resize.originalDocumentState };
    const previousStateOverrides = { ...resize.originalStateOverrideStyles };
    const stateOverrideTargets = { ...resize.stateOverrideTargets };

    const root = selectDocumentRoot(state);

    // Apply normalization (clear fill indicators) - dimensions already applied in updateResize
    mimic.document.transaction((transactionRoot) => {
      for (const [nodeId, dims] of Object.entries(finalDimensions)) {
        const stateId = stateOverrideTargets[nodeId];
        if (dims.type === "view" || dims.type === "scrollView") {
          const proxy = resolveViewLikeProxy(transactionRoot, nodeId, dims.type);
          if (proxy) {
            const prev = previousState[nodeId];
            const parentDirection = getParentFlexDirection(root, nodeId);

            // Normalize sizing to clear fill indicators when setting explicit dimensions
            const normalized = normalizeFlexSizing(
              {
                width: dims.width,
                height: dims.height,
              },
              {
                width: prev?.width ?? null,
                height: prev?.height ?? null,
                flex: prev?.flex ?? null,
                alignSelf: asAlignSelf(prev?.alignSelf),
              },
              parentDirection,
            );

            if (stateId) {
              const stateProxy = resolveStateOverridesProxy(
                transactionRoot,
                nodeId,
                dims.type,
                stateId,
              );
              if (!stateProxy) {
                continue;
              }
              if (normalized.flex !== undefined) {
                const baseFlex = proxy.data.style.flex.get();
                if (normalized.flex === null || normalized.flex === baseFlex) {
                  removeStateStyleOverride(stateProxy, "flex");
                } else {
                  upsertStateStyleOverride(stateProxy, "flex", normalized.flex);
                }
              }
              if (normalized.alignSelf !== undefined) {
                const baseAlignSelf = proxy.data.style.alignSelf.get();
                if (normalized.alignSelf === baseAlignSelf) {
                  removeStateStyleOverride(stateProxy, "alignSelf");
                } else {
                  upsertStateStyleOverride(stateProxy, "alignSelf", normalized.alignSelf);
                }
              }
              continue;
            }

            if (normalized.flex !== undefined) {
              if (normalized.flex === null) {
                proxy.data.style.update({ flex: undefined });
              } else {
                proxy.data.style.flex.set(normalized.flex);
              }
            }
            if (normalized.alignSelf !== undefined) {
              proxy.data.style.alignSelf.set(normalized.alignSelf);
            }
          }
        }
      }
    });

    ctx.setState({
      resize: {
        currentNodeDimensions: {},
        handle: null,
        initialCombinedBounds: null,
        initialNodeDimensions: {},
        originalStateOverrideStyles: {},
        originalDocumentState: {},
        stateOverrideTargets: {},
        isActive: false,
        startScreenPoint: null,
      },
    });

    return {
      finalDimensions,
      previousState,
      previousStateOverrides,
      stateOverrideTargets,
    };
  },
  (ctx, _params, result) => {
    // Undo: restore previous state including width, height, flex, alignSelf
    const { mimic } = ctx.getState();

    mimic.document.transaction((root) => {
      for (const [nodeId, prev] of Object.entries(result.previousState)) {
        const stateId = result.stateOverrideTargets[nodeId];
        if (stateId) {
          const stateProxy =
            prev.type === "screen" ||
            prev.type === "view" ||
            prev.type === "scrollView" ||
            prev.type === "shape"
              ? resolveStateOverridesProxy(root, nodeId, prev.type, stateId)
              : undefined;
          if (!stateProxy) {
            continue;
          }
          stateProxy.overrides.style.set(result.previousStateOverrides[nodeId] ?? {});
          continue;
        }

        if (prev.type === "screen") {
          const proxy = findTypedNode(root, nodeId, ScreenNode);
          if (proxy) {
            if (typeof prev.width === "number") {
              proxy.data.style.width.set(prev.width);
            }
            if (typeof prev.height === "number") {
              proxy.data.style.height.set(prev.height);
            }
          }
        } else if (prev.type === "view" || prev.type === "scrollView") {
          const proxy = resolveViewLikeProxy(root, nodeId, prev.type);
          if (proxy) {
            proxy.data.style.width.set(prev.width);
            proxy.data.style.height.set(prev.height);
            if (prev.flex === undefined) {
              proxy.data.style.update({ flex: undefined });
            } else {
              proxy.data.style.flex.set(prev.flex);
            }
            const alignSelf = asAlignSelf(prev.alignSelf);
            if (alignSelf !== undefined) {
              proxy.data.style.alignSelf.set(alignSelf);
            }
          }
        } else if (prev.type === "shape") {
          const proxy = findTypedNode(root, nodeId, ShapeNode);
          if (proxy) {
            proxy.data.style.width.set(prev.width);
            proxy.data.style.height.set(prev.height);
          }
        }
      }
    });
  },
);

/**
 * Cancel resize without committing changes.
 * The draft system's discardDraft() handles reverting mimic changes.
 */
export const cancelResize = commander.action((ctx) => {
  const state = ctx.getState();
  const { resize } = state;

  if (!resize.isActive) {
    return;
  }

  // Reset resize state - mimic revert is handled by discardDraft() in the component
  ctx.setState({
    resize: {
      currentNodeDimensions: {},
      handle: null,
      initialCombinedBounds: null,
      initialNodeDimensions: {},
      originalStateOverrideStyles: {},
      originalDocumentState: {},
      stateOverrideTargets: {},
      isActive: false,
      startScreenPoint: null,
    },
  });
});
