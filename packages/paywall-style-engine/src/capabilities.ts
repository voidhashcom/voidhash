import type { JustifyContent } from "@voidhash/mimic-schema";

import { nodeStyleFields } from "./introspection.ts";
import {
  deriveAxisSizing,
  type AxisSizing,
  type DimensionAxis,
  type SizingMode,
  type StyleTargetView,
} from "./model.ts";

/**
 * Machine-readable reason a feature is not available for a node right now.
 * Editors surface these as disabled-with-explanation instead of hiding
 * controls, so "why can't I do this" is always answerable.
 */
export type CapabilityReason =
  /** The node type's style schema does not carry the backing fields. */
  | "node-type-unsupported"
  /** The node type persists a fixed numeric size only (screen frames). */
  | "fixed-size-only"
  /** Fill needs a flex parent to fill against; this node has none. */
  | "no-flex-parent"
  /** The selection spans nodes whose availability differs. */
  | "mixed-selection";

export type Availability =
  | { readonly status: "available" }
  | { readonly status: "disabled"; readonly reason: CapabilityReason }
  | { readonly status: "hidden"; readonly reason: CapabilityReason };

const AVAILABLE: Availability = { status: "available" };

/** Per-axis sizing capability: which modes are reachable, and the current derived sizing. */
export interface AxisCapability {
  readonly modes: Readonly<Record<SizingMode, Availability>>;
  readonly current: AxisSizing;
}

/**
 * The alignment-control shape the current container values allow.
 * `space-between` distributes the main axis (align-only strip); everything
 * else is the full 3x3 grid — `alignItems: "stretch"` is not a grid state
 * (virtual stretch: it renders as no explicit alignment, with cross-axis fill
 * expressed per child via the Fill sizing mode).
 */
export type AlignmentControlMode = "grid" | "align-only";

export interface ContainerCapability {
  readonly alignmentControl: AlignmentControlMode;
}

/** The engine's availability answer for one node. */
export interface NodeStyleCapabilities {
  /** The legal style field names for this node type — anything else is rejected. */
  readonly styleFields: readonly string[];
  /** Sizing per axis; `hidden` axes have no backing fields (text nodes). */
  readonly sizing: Readonly<Record<DimensionAxis, AxisCapability | null>>;
  /** Whether the node can toggle absolute positioning. */
  readonly positioning: Availability;
  /** Container (flex parent) controls, when the node lays out children. */
  readonly container: ContainerCapability | null;
}

function axisCapability(view: StyleTargetView, axis: DimensionAxis): AxisCapability | null {
  const fields = nodeStyleFields(view.nodeType);
  if (!fields.includes(axis)) return null;

  const current = deriveAxisSizing(axis, view.style, view.parent);

  // A node without alignSelf/flex fields persists numbers only — screens.
  const hasFlexChildFields = fields.includes("alignSelf") || fields.includes("flex");
  if (!hasFlexChildFields) {
    const fixedOnly: Availability = { status: "hidden", reason: "fixed-size-only" };
    return {
      current,
      modes: { fixed: AVAILABLE, hug: fixedOnly, fill: fixedOnly },
    };
  }

  const fill: Availability =
    view.parent === null ? { status: "disabled", reason: "no-flex-parent" } : AVAILABLE;
  return { current, modes: { fixed: AVAILABLE, hug: AVAILABLE, fill } };
}

/** Compute the full capability surface for one node view. */
export function nodeCapabilities(view: StyleTargetView): NodeStyleCapabilities {
  const fields = nodeStyleFields(view.nodeType);

  const positioning: Availability = fields.includes("position")
    ? AVAILABLE
    : { status: "hidden", reason: "node-type-unsupported" };

  let container: ContainerCapability | null = null;
  if (fields.includes("flexDirection")) {
    const justifyContent = view.style["justifyContent"] as JustifyContent | undefined;
    const alignmentControl: AlignmentControlMode =
      justifyContent === "space-between" ? "align-only" : "grid";
    container = { alignmentControl };
  }

  return {
    styleFields: fields,
    sizing: {
      width: axisCapability(view, "width"),
      height: axisCapability(view, "height"),
    },
    positioning,
    container,
  };
}

/** One feature's availability across a selection, with mixed-value tracking. */
export interface SelectionAxisCapability extends AxisCapability {
  /** The per-node current sizings disagree (editors show a mixed indicator). */
  readonly mixed: boolean;
}

export interface SelectionCapabilities {
  /** Style fields legal for EVERY node in the selection. */
  readonly styleFields: readonly string[];
  readonly sizing: Readonly<Record<DimensionAxis, SelectionAxisCapability | null>>;
  readonly positioning: Availability;
  /** Container controls when every node is a container; mixed values collapse to `grid`. */
  readonly container: ContainerCapability | null;
  /** Style fields whose EFFECTIVE values differ across the selection. */
  readonly mixedFields: ReadonlySet<string>;
}

function intersectAvailability(a: Availability, b: Availability): Availability {
  if (a.status === "available" && b.status === "available") return AVAILABLE;
  if (a.status !== "available" && b.status !== "available") {
    return a.reason === b.reason ? a : { status: "disabled", reason: "mixed-selection" };
  }
  return { status: "disabled", reason: "mixed-selection" };
}

function styleValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Intersect per-node capabilities across a selection: a mode is available only
 * when it is available for every node, and a field is mixed when any two nodes
 * disagree on its effective value. Empty selections yield `null`.
 */
export function selectionCapabilities(views: readonly StyleTargetView[]): SelectionCapabilities | null {
  if (views.length === 0) return null;
  const firstView = views[0];
  if (firstView === undefined) return null;
  const perNode = views.map(nodeCapabilities);
  const first = perNode[0];
  if (first === undefined) return null;

  const styleFields = first.styleFields.filter((field) =>
    perNode.every((caps) => caps.styleFields.includes(field)),
  );

  const mixedFields = new Set<string>();
  for (const field of styleFields) {
    const reference = firstView.style[field];
    if (views.some((view) => !styleValuesEqual(view.style[field], reference))) {
      mixedFields.add(field);
    }
  }

  const sizingAxis = (axis: DimensionAxis): SelectionAxisCapability | null => {
    const axes = perNode.map((caps) => caps.sizing[axis]);
    if (axes.some((capability) => capability === null)) return null;
    const present = axes as AxisCapability[];
    const head = present[0];
    if (head === undefined) return null;
    const modes = {
      fixed: present.map((c) => c.modes.fixed).reduce(intersectAvailability),
      hug: present.map((c) => c.modes.hug).reduce(intersectAvailability),
      fill: present.map((c) => c.modes.fill).reduce(intersectAvailability),
    };
    const mixed = present.some(
      (c) => c.current.mode !== head.current.mode || c.current.px !== head.current.px,
    );
    return { modes, current: head.current, mixed };
  };

  return {
    styleFields,
    sizing: { width: sizingAxis("width"), height: sizingAxis("height") },
    positioning: perNode.map((caps) => caps.positioning).reduce(intersectAvailability),
    container: perNode.every((caps) => caps.container !== null) ? first.container : null,
    mixedFields,
  };
}
