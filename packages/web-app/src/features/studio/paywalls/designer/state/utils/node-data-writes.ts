import type { Primitive } from "@voidhash/mimic-core";
import {
  PathNode,
  ScreenNode,
  ScrollViewNode,
  ShapeNode,
  TextNode,
  ViewNode,
} from "@voidhash/mimic-schema";

import { findTypedNode, type DesignerDocumentRoot } from "./node-proxies";
import { unwrapEntriesDeep } from "./replay";

type NodeDataSnapshot<TNode extends Primitive.AnyTreeNodePrimitive> = NonNullable<
  Primitive.InferSnapshot<Primitive.InferTreeNodeData<TNode>>
>;

type NodeDataUpdates<TNode extends Primitive.AnyTreeNodePrimitive> = Primitive.InferUpdateInput<
  Primitive.InferTreeNodeData<TNode>
>;

/**
 * Applies a node `update` and captures the previous values of the restorable
 * (non-array) fields it touches, for undo restore. Array fields (`states`,
 * `interactions`, `localVariables`, `linkedVariables`) are deliberately never
 * captured: snapshot entries are `{id, pos, value}`-wrapped and must be
 * restored through their dedicated entry-addressed actions instead of
 * `update`. Returns `undefined` when the node does not exist or has another
 * type.
 */
const captureAndUpdateNodeData = <
  TNode extends Primitive.AnyTreeNodePrimitive,
  K extends keyof NodeDataSnapshot<TNode> & string,
>(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: TNode,
  restorableKeys: readonly K[],
  updates: NodeDataUpdates<TNode>,
): Partial<Pick<NodeDataSnapshot<TNode>, K>> | undefined => {
  const node = findTypedNode(root, nodeId, nodeType);
  if (node === undefined) {
    return undefined;
  }
  const snapshot = node.get();
  if (snapshot === undefined) {
    return undefined;
  }

  const data: NodeDataSnapshot<TNode> | undefined = snapshot.data;
  if (data === undefined) {
    return undefined;
  }
  const previousValues: Partial<Pick<NodeDataSnapshot<TNode>, K>> = {};
  for (const key of restorableKeys) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      previousValues[key] = data[key];
    }
  }
  node.update(updates);
  return previousValues;
};

const VIEW_RESTORABLE_KEYS = ["name", "style"] as const;
const SCROLLVIEW_RESTORABLE_KEYS = [
  "name",
  "style",
  "horizontal",
  "showsScrollIndicator",
] as const;
const SCREEN_RESTORABLE_KEYS = ["name", "style"] as const;
const TEXT_RESTORABLE_KEYS = ["name", "style", "text"] as const;
const PATH_RESTORABLE_KEYS = ["d", "name", "style", "transform"] as const;
const SHAPE_RESTORABLE_KEYS = ["name", "style", "svgSource", "viewBox"] as const;

/** Bivariant structural view of a style struct proxy for generic restores. */
interface StyleWriteProxy {
  update(value: Record<string, unknown>): void;
}

/**
 * Restores a captured style snapshot. Optional style fields (`flex` and the
 * min/max constraints) snapshot as ABSENT when unset, so they are explicitly
 * deleted first — a plain partial update would leave values the undone
 * action introduced. Keys unknown to a node type's style schema are ignored
 * by the struct update.
 *
 * Structured fields need care the plain spread cannot give: the captured
 * snapshot carries nested array elements (e.g. `backgroundGradient.stops`) in
 * the CRDT `{id, pos, value}` entry wrapper while `update` expects logical
 * input — replaying the wrapper would collapse every element to its schema
 * defaults. So values are unwrapped, and keys whose unwrapped value matches
 * the current style are skipped entirely, which also preserves the entry
 * identity (ids/positions) of untouched nested arrays.
 */
const restoreStyle = (
  styleProxy: StyleWriteProxy,
  previousStyle: Record<string, unknown>,
  currentStyle: Record<string, unknown>,
): void => {
  const restored = unwrapEntriesDeep(previousStyle) as Record<string, unknown>;
  const current = unwrapEntriesDeep(currentStyle) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    flex: undefined,
    maxHeight: undefined,
    maxWidth: undefined,
    minHeight: undefined,
    minWidth: undefined,
  };
  for (const [key, value] of Object.entries(restored)) {
    if (JSON.stringify(value) === JSON.stringify(current[key])) {
      // Unchanged — do not rewrite it, and do not let the optional-field
      // deletion markers above delete a value the restore should keep.
      delete payload[key];
      continue;
    }
    payload[key] = value;
  }
  styleProxy.update(payload);
};

/** Previous values of the restorable view-node fields an update touched. */
export type ViewNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof ViewNode>, (typeof VIEW_RESTORABLE_KEYS)[number]>
>;

/** Previous values of the restorable scrollView-node fields an update touched. */
export type ScrollViewNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof ScrollViewNode>, (typeof SCROLLVIEW_RESTORABLE_KEYS)[number]>
>;

/** Previous values of the restorable screen-node fields an update touched. */
export type ScreenNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof ScreenNode>, (typeof SCREEN_RESTORABLE_KEYS)[number]>
>;

/** Previous values of the restorable text-node fields an update touched. */
export type TextNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof TextNode>, (typeof TEXT_RESTORABLE_KEYS)[number]>
>;

/** Previous values of the restorable path-node fields an update touched. */
export type PathNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof PathNode>, (typeof PATH_RESTORABLE_KEYS)[number]>
>;

/** Previous values of the restorable shape-node fields an update touched. */
export type ShapeNodePreviousValues = Partial<
  Pick<NodeDataSnapshot<typeof ShapeNode>, (typeof SHAPE_RESTORABLE_KEYS)[number]>
>;

/**
 * Applies a view-node `update`, capturing touched restorable fields for undo.
 * See {@link captureAndUpdateNodeData} for why array fields are excluded.
 */
export const updateViewNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof ViewNode>,
): ViewNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, ViewNode, VIEW_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updateViewNodeData}. */
export const restoreViewNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: ViewNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, ViewNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};

/**
 * Applies a scrollView-node `update`, capturing touched restorable fields for
 * undo. Covers the view-identical `name`/`style` plus the scrollView-only
 * `horizontal`/`showsScrollIndicator` data flags. See
 * {@link captureAndUpdateNodeData} for why array fields are excluded.
 */
export const updateScrollViewNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof ScrollViewNode>,
): ScrollViewNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, ScrollViewNode, SCROLLVIEW_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updateScrollViewNodeData}. */
export const restoreScrollViewNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: ScrollViewNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, ScrollViewNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};

/**
 * Applies a screen-node `update`, capturing touched restorable fields for
 * undo. See {@link captureAndUpdateNodeData} for why array fields are
 * excluded.
 */
export const updateScreenNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof ScreenNode>,
): ScreenNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, ScreenNode, SCREEN_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updateScreenNodeData}. */
export const restoreScreenNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: ScreenNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, ScreenNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};

/**
 * Applies a text-node `update`, capturing touched restorable fields for undo.
 * See {@link captureAndUpdateNodeData} for why array fields are excluded.
 */
export const updateTextNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof TextNode>,
): TextNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, TextNode, TEXT_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updateTextNodeData}. */
export const restoreTextNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: TextNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, TextNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};

/**
 * Applies a path-node `update`, capturing touched restorable fields for undo.
 * See {@link captureAndUpdateNodeData} for why array fields are excluded.
 * An absent `transform` snapshots as `undefined` and restores as a field
 * deletion.
 */
export const updatePathNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof PathNode>,
): PathNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, PathNode, PATH_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updatePathNodeData}. */
export const restorePathNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: PathNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, PathNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};

/**
 * Applies a shape-node `update`, capturing touched restorable fields for
 * undo. See {@link captureAndUpdateNodeData} for why array fields are
 * excluded. An absent `svgSource` snapshots as `undefined` and restores as a
 * field deletion.
 */
export const updateShapeNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: NodeDataUpdates<typeof ShapeNode>,
): ShapeNodePreviousValues | undefined =>
  captureAndUpdateNodeData(root, nodeId, ShapeNode, SHAPE_RESTORABLE_KEYS, updates);

/** Restores the fields captured by {@link updateShapeNodeData}. */
export const restoreShapeNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: ShapeNodePreviousValues,
): void => {
  const node = findTypedNode(root, nodeId, ShapeNode);
  if (node === undefined) {
    return;
  }
  const { style, ...rest } = previousValues;
  node.update(rest);
  if (style !== undefined) {
    restoreStyle(
      node.data.style,
      style,
      (node.get()?.data.style ?? {}) as Record<string, unknown>,
    );
  }
};
