import type { AlignItems, AlignSelf, FlexDirection, NodeType } from "@voidhash/mimic-schema";

/**
 * The flex context a node's parent provides. `null` when the node has no flex
 * parent (e.g. a screen on the canvas), which disables flex-child semantics.
 */
export interface ParentFlexContext {
  readonly direction: FlexDirection;
  readonly alignItems: AlignItems;
}

/**
 * A plain-data view of one style-edit target. The engine is pure: callers (the
 * designer store adapter, the playground harness, tests) project their document
 * snapshot into this shape; the engine never touches a store or a CRDT proxy.
 *
 * `style` is the EFFECTIVE style (state-override-resolved) the user sees;
 * `baseStyle` is the committed base layer. Both are decoded snapshot records
 * (CRDT array envelopes are tolerated everywhere and unwrapped before writes).
 */
export interface StyleTargetView {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly style: Record<string, unknown>;
  readonly baseStyle: Record<string, unknown>;
  readonly parent: ParentFlexContext | null;
  /** The selected state layer, when edits target a state's style overrides. */
  readonly stateId?: string;
  readonly stateOverrides?: Record<string, unknown>;
}

export type DimensionAxis = "width" | "height";
export type SizingMode = "fill" | "hug" | "fixed";

/** One axis of the sizing model: the derived mode plus the stored px when fixed. */
export interface AxisSizing {
  readonly mode: SizingMode;
  readonly px?: number;
}

/**
 * The parent flex direction under which this axis is the CROSS axis (stretched
 * via `alignSelf` rather than `flex: 1`): width stretches in a column parent,
 * height in a row parent.
 */
export function stretchDirectionFor(axis: DimensionAxis): FlexDirection {
  return axis === "width" ? "column" : "row";
}

function sizeOf(style: Record<string, unknown>, axis: DimensionAxis): number | "auto" {
  const value = style[axis];
  if (typeof value === "number") return value;
  return "auto";
}

function alignSelfOf(style: Record<string, unknown>): AlignSelf {
  const value = style["alignSelf"];
  return typeof value === "string" ? (value as AlignSelf) : "auto";
}

/**
 * Derives the fill/hug/fixed sizing for one axis from the stored style and the
 * parent flex context.
 *
 * CSS ground truth: a child fills its CROSS axis iff its resolved alignment is
 * stretch AND its cross size is `auto` — so a numeric size wins (fixed); an
 * `auto` size fills when `alignSelf` is `"stretch"`, or when `alignSelf` is
 * `"auto"` and the parent's `alignItems` is `"stretch"`; otherwise it hugs. On
 * the MAIN axis `flex: 1` fills, `auto` hugs, numeric is fixed. Without a flex
 * parent only fixed/hug exist.
 */
export function deriveAxisSizing(
  axis: DimensionAxis,
  style: Record<string, unknown>,
  parent: ParentFlexContext | null,
): AxisSizing {
  const size = sizeOf(style, axis);

  if (parent === null) {
    return size === "auto" ? { mode: "hug" } : { mode: "fixed", px: size };
  }

  if (parent.direction === stretchDirectionFor(axis)) {
    if (size !== "auto") {
      return { mode: "fixed", px: size };
    }
    const alignSelf = alignSelfOf(style);
    if (alignSelf === "stretch" || (alignSelf === "auto" && parent.alignItems === "stretch")) {
      return { mode: "fill" };
    }
    return { mode: "hug" };
  }

  if (style["flex"] === 1) {
    return { mode: "fill" };
  }
  if (size === "auto") {
    return { mode: "hug" };
  }
  return { mode: "fixed", px: size };
}

/**
 * The `alignSelf` to write when switching a CROSS-axis dimension to Hug:
 * preserve an explicit non-stretch alignment; otherwise opt out of a
 * stretch-by-default parent with `"flex-start"` (so Hug is actually reachable —
 * an `"auto"` child would keep stretching); otherwise `"auto"`.
 */
export function hugAlignSelf(currentAlignSelf: AlignSelf, parentAlignItems: AlignItems): AlignSelf {
  if (currentAlignSelf !== "auto" && currentAlignSelf !== "stretch") {
    return currentAlignSelf;
  }
  return parentAlignItems === "stretch" ? "flex-start" : "auto";
}

/**
 * The `alignSelf` to write when giving a CROSS-axis dimension a fixed size:
 * numeric size defeats stretch, so clear an `auto`/`stretch` alignSelf to
 * `"auto"` while preserving any explicit alignment the author chose.
 */
export function fixedAlignSelf(currentAlignSelf: AlignSelf): AlignSelf {
  return currentAlignSelf === "stretch" || currentAlignSelf === "auto" ? "auto" : currentAlignSelf;
}

/**
 * A style patch in the engine's WRITE vocabulary: values are logical style
 * values, `undefined` means "delete the field" (the stored field is absent).
 * This replaces the legacy `null`-clear sentinel at the engine boundary.
 */
export type StylePatch = Record<string, unknown>;

/**
 * The paired `width|height`/`flex`/`alignSelf` patch a fill/hug/fixed mode
 * switch writes for one axis — the single source of truth for the CSS-correct
 * pairing on both axes.
 */
export function sizingModePatch(
  axis: DimensionAxis,
  mode: SizingMode,
  opts: {
    /** The px written when switching to fixed (usually the live computed size). */
    fixedPx: number;
    parent: ParentFlexContext | null;
    currentAlignSelf: AlignSelf;
  },
): StylePatch {
  const isCrossAxis = opts.parent !== null && opts.parent.direction === stretchDirectionFor(axis);
  const patch: StylePatch = {};

  if (mode === "fill") {
    patch[axis] = "auto";
    if (isCrossAxis) patch["alignSelf"] = "stretch";
    else patch["flex"] = 1;
    return patch;
  }

  if (mode === "hug") {
    patch[axis] = "auto";
    if (isCrossAxis) {
      patch["alignSelf"] = hugAlignSelf(
        opts.currentAlignSelf,
        opts.parent?.alignItems ?? "stretch",
      );
    } else {
      patch["flex"] = undefined;
    }
    return patch;
  }

  patch[axis] = opts.fixedPx;
  if (isCrossAxis) patch["alignSelf"] = fixedAlignSelf(opts.currentAlignSelf);
  else patch["flex"] = undefined;
  return patch;
}
