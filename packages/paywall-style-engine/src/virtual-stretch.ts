import type { AlignItems, FlexDirection } from "@voidhash/mimic-schema";

import type { StylePatch } from "./model.ts";

/** The minimal per-child view the virtual-stretch transforms read. */
export interface StretchChildView {
  readonly nodeId: string;
  readonly style: Record<string, unknown>;
}

/** Patches produced by a virtual-stretch transform, keyed off the container. */
export interface ContainerStretchPlan {
  readonly parentPatch: StylePatch;
  readonly childPatches: ReadonlyMap<string, StylePatch>;
}

function directionOf(parentStyle: Record<string, unknown>): FlexDirection {
  return parentStyle["flexDirection"] === "row" ? "row" : "column";
}

/** The cross-axis size field of a child under `direction`. */
function crossSizeField(direction: FlexDirection): "width" | "height" {
  return direction === "column" ? "width" : "height";
}

function isContainerDrivenFill(child: StretchChildView, direction: FlexDirection): boolean {
  const alignSelf = child.style["alignSelf"];
  const crossSize = child.style[crossSizeField(direction)];
  return (alignSelf === "auto" || alignSelf === undefined) && typeof crossSize !== "number";
}

/**
 * The COLLAPSE direction of virtual stretch: when every child of a container
 * carries an explicit `alignSelf: "stretch"` (the per-child "Fill container"
 * the UI exposes), the canonical persisted form is the CSS identity — parent
 * `alignItems: "stretch"` with the redundant child markers cleared to
 * `"auto"` (container-driven). `overrides` lets a caller fold in child styles
 * it is about to write, so the collapse can be planned BEFORE those writes
 * land instead of writing stretch and immediately rewriting it.
 *
 * Returns `null` when the container is not collapsible (no children, or any
 * child not explicitly stretching).
 */
export function collapseContainerStretch(
  parentStyle: Record<string, unknown>,
  children: readonly StretchChildView[],
  overrides?: ReadonlyMap<string, StylePatch>,
): ContainerStretchPlan | null {
  if (children.length === 0) return null;

  const effectiveAlignSelf = (child: StretchChildView): unknown => {
    const override = overrides?.get(child.nodeId);
    if (override && "alignSelf" in override) return override["alignSelf"];
    return child.style["alignSelf"];
  };

  if (!children.every((child) => effectiveAlignSelf(child) === "stretch")) {
    return null;
  }

  const childPatches = new Map<string, StylePatch>();
  for (const child of children) {
    childPatches.set(child.nodeId, { alignSelf: "auto" });
  }
  const parentPatch: StylePatch =
    parentStyle["alignItems"] === "stretch" ? {} : { alignItems: "stretch" };
  return { parentPatch, childPatches };
}

/**
 * The EXPAND direction of virtual stretch: moving a stretch container to an
 * explicit alignment must not visually collapse the children that were
 * filling the cross axis container-driven (`alignSelf: "auto"` under
 * `alignItems: "stretch"`). Those children get an explicit
 * `alignSelf: "stretch"` alongside the parent's new alignment, so the layout
 * is unchanged and each child's Fill stays individually revocable.
 *
 * A no-op (empty child patches) when the parent was not stretching or the new
 * value is itself `"stretch"`.
 */
export function expandContainerStretch(
  parentStyle: Record<string, unknown>,
  children: readonly StretchChildView[],
  nextAlignItems: AlignItems,
): ContainerStretchPlan {
  const parentPatch: StylePatch = { alignItems: nextAlignItems };
  const childPatches = new Map<string, StylePatch>();

  if (parentStyle["alignItems"] !== "stretch" || nextAlignItems === "stretch") {
    return { parentPatch, childPatches };
  }

  const direction = directionOf(parentStyle);
  for (const child of children) {
    if (isContainerDrivenFill(child, direction)) {
      childPatches.set(child.nodeId, { alignSelf: "stretch" });
    }
  }
  return { parentPatch, childPatches };
}
