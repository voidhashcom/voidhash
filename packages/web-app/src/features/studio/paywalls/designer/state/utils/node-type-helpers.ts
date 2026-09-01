import { canHaveChildren as canHaveChildrenFromCatalog } from "@voidhash/mimic-schema";
import type { AlignItems } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import * as Option from "effect/Option";

/**
 * Node types that can act as flex parents (have flexDirection, can contain flex children).
 * Add new container types here when they're introduced.
 */
const FLEX_PARENT_TYPES = new Set(["view", "scrollView", "screen"]);

/**
 * Node types that can act as flex children (can have flex, alignSelf properties).
 * Includes shape since shapes can be flex children.
 */
const FLEX_CHILD_TYPES = new Set(["view", "scrollView", "screen", "shape"]);

/**
 * Check if a node can act as a flex parent (has flexDirection, alignItems, justifyContent).
 * Use this when you need to get parent's flex direction or check if a node can have flex children.
 */
export function isFlexParent(node: { type: string } | null | undefined): boolean {
  return node != null && FLEX_PARENT_TYPES.has(node.type);
}

/**
 * Check if a node can act as a flex child (can have flex, alignSelf properties).
 * Use this when determining if sizing modes (hug/fill/custom) apply.
 */
export function isFlexChild(node: { type: string } | null | undefined): boolean {
  return node != null && FLEX_CHILD_TYPES.has(node.type);
}

/**
 * Check if a node can contain children.
 * Use this for drag-drop, tree building, etc.
 */
export function canHaveChildren(node: { type: string } | null | undefined): boolean {
  return node != null && canHaveChildrenFromCatalog(Option.some(node.type));
}

/**
 * Check if a node type string represents a flex parent.
 */
export function isFlexParentType(type: string | null | undefined): boolean {
  return type != null && FLEX_PARENT_TYPES.has(type);
}

/**
 * Check if a node type string represents a flex child.
 */
export function isFlexChildType(type: string | null | undefined): boolean {
  return type != null && FLEX_CHILD_TYPES.has(type);
}

/**
 * Check if a node type string can have children.
 */
export function canHaveChildrenType(type: string | null | undefined): boolean {
  return canHaveChildrenFromCatalog(Option.fromNullishOr(type));
}

/**
 * Get flex direction from a node if it's a flex parent, otherwise return default.
 */
export function getFlexDirection(
  node: SnapshotNode | null | undefined,
  defaultDirection: "row" | "column" = "column",
): "row" | "column" {
  if (!node || !isFlexParent(node)) {
    return defaultDirection;
  }
  if (node.type === "view" || node.type === "scrollView" || node.type === "screen") {
    return node.data.style.flexDirection;
  }
  return defaultDirection;
}

/**
 * Get the resolved `alignItems` of a flex parent, else the fallback. Used to
 * decide whether a child stretches on the cross axis by default (an
 * `alignSelf: "auto"` child fills the cross axis only when its parent's
 * `alignItems` is `"stretch"` — the schema default).
 */
export function getAlignItems(
  node: SnapshotNode | null | undefined,
  fallback: AlignItems = "stretch",
): AlignItems {
  if (!node || !isFlexParent(node)) {
    return fallback;
  }
  if (node.type === "view" || node.type === "scrollView" || node.type === "screen") {
    return node.data.style.alignItems;
  }
  return fallback;
}

/**
 * Minimum size (px) seeded on a designer click-inserted view along its parent's
 * MAIN axis so the empty view stays visible under hug-by-default sizing (an
 * empty hugging view would otherwise collapse to zero on that axis).
 */
export const DESIGNER_INSERT_MIN_SIZE = 100;

/**
 * The initial style a DESIGNER click-inserted view gets so it stays visible:
 * it stretches on the parent's cross axis (`alignSelf: "stretch"`) and takes a
 * minimum size on the parent's main axis (which would otherwise hug to zero).
 * Direction-aware by the PARENT's `flexDirection`. AI-created views deliberately
 * skip this — they hug like real CSS.
 */
export function designerInsertViewStyle(
  parentDirection: "row" | "column",
): { alignSelf: "stretch"; minHeight: number } | { alignSelf: "stretch"; minWidth: number } {
  return parentDirection === "column"
    ? { alignSelf: "stretch", minHeight: DESIGNER_INSERT_MIN_SIZE }
    : { alignSelf: "stretch", minWidth: DESIGNER_INSERT_MIN_SIZE };
}
