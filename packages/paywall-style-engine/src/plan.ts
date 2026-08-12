import { nodeCapabilities } from "./capabilities.ts";
import { errorDiagnostic, type StyleDiagnostic } from "./diagnostics.ts";
import { normalizeStylePatch, repairFlexSizing } from "./normalize.ts";
import {
  sizingModePatch,
  type DimensionAxis,
  type SizingMode,
  type StylePatch,
  type StyleTargetView,
} from "./model.ts";
import { validateStylePatch } from "./validate.ts";

/**
 * The semantic edit operations editors issue instead of writing raw style
 * props. `setStyle` is the generic escape hatch — still validated, normalized,
 * and flex-repaired; the dedicated ops additionally own the paired-field
 * derivations that previously lived inside panel components.
 */
export type StyleEditOp =
  | { readonly kind: "setStyle"; readonly style: Record<string, unknown> }
  | {
      readonly kind: "setSizingMode";
      readonly axis: DimensionAxis;
      readonly mode: SizingMode;
      /** The px written when switching to fixed; defaults to the live computed size. */
      readonly fixedPx?: number;
    }
  | { readonly kind: "setSize"; readonly axis: DimensionAxis; readonly value: number }
  | {
      readonly kind: "setPositioning";
      readonly mode: "flow" | "absolute";
      /** Seed offsets when entering absolute (per node; from bounding boxes). */
      readonly insets?: { left?: number; top?: number; right?: number; bottom?: number };
    };

/**
 * How the adapter must write a node's patch: `merge-update` = per-key struct
 * update (scalars); `whole-set` = merged whole-record set (required whenever a
 * structured value is written, because struct `update` cannot introduce a
 * nested-struct field and dies on missing_field).
 */
export type WriteDiscipline = "merge-update" | "whole-set";

export interface NodeWritePlan {
  readonly nodeId: string;
  /** Normalized patch in write vocabulary (`undefined` = delete the field). */
  readonly patch: StylePatch;
  /** `base` targets `data.style`; `state` targets the selected state's overrides. */
  readonly layer: { readonly kind: "base" } | { readonly kind: "state"; readonly stateId: string };
  readonly discipline: WriteDiscipline;
  readonly diagnostics: readonly StyleDiagnostic[];
}

export interface StyleWritePlan {
  readonly nodes: readonly NodeWritePlan[];
  /** Plan-level findings (per-node findings live on each node plan). */
  readonly diagnostics: readonly StyleDiagnostic[];
  /** True when every node plan is empty or error-blocked — nothing to execute. */
  readonly empty: boolean;
}

/** The live computed pixel sizes for a node, when the caller has bounding boxes. */
export interface ComputedSizes {
  readonly width?: number;
  readonly height?: number;
}

export interface PlanOptions {
  readonly computedSizes?: ReadonlyMap<string, ComputedSizes>;
  /** Fallback px when switching to fixed without a live bounding box. */
  readonly fallbackFixedPx?: number;
}

const DEFAULT_FALLBACK_FIXED_PX = 100;

function isPlainStructuredValue(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function opPatchFor(
  op: StyleEditOp,
  view: StyleTargetView,
  options: PlanOptions,
): { patch: Record<string, unknown>; diagnostics: StyleDiagnostic[] } {
  switch (op.kind) {
    case "setStyle":
      return { patch: { ...op.style }, diagnostics: [] };
    case "setSizingMode": {
      const capabilities = nodeCapabilities(view);
      const axisCapability = capabilities.sizing[op.axis];
      if (axisCapability === null) {
        return {
          patch: {},
          diagnostics: [
            errorDiagnostic(
              "capability-unavailable",
              `${view.nodeType} nodes have no ${op.axis} sizing`,
              { nodeId: view.nodeId, field: op.axis },
            ),
          ],
        };
      }
      const availability = axisCapability.modes[op.mode];
      if (availability.status !== "available") {
        return {
          patch: {},
          diagnostics: [
            errorDiagnostic(
              "capability-unavailable",
              `sizing mode "${op.mode}" is ${availability.status} for ${op.axis} (${availability.reason})`,
              { nodeId: view.nodeId, field: op.axis },
            ),
          ],
        };
      }
      const computed = options.computedSizes?.get(view.nodeId)?.[op.axis];
      const stored = view.style[op.axis];
      const fixedPx =
        op.fixedPx ??
        computed ??
        (typeof stored === "number"
          ? stored
          : (options.fallbackFixedPx ?? DEFAULT_FALLBACK_FIXED_PX));
      const currentAlignSelf = view.style["alignSelf"];
      return {
        patch: sizingModePatch(op.axis, op.mode, {
          fixedPx,
          parent: view.parent,
          currentAlignSelf:
            typeof currentAlignSelf === "string"
              ? (currentAlignSelf as never)
              : ("auto" as never),
        }),
        diagnostics: [],
      };
    }
    case "setSize":
      return { patch: { [op.axis]: op.value }, diagnostics: [] };
    case "setPositioning": {
      if (op.mode === "flow") {
        return {
          patch: { position: "relative", left: "auto", top: "auto", right: "auto", bottom: "auto" },
          diagnostics: [],
        };
      }
      return {
        patch: {
          position: "absolute",
          left: op.insets?.left ?? 0,
          top: op.insets?.top ?? 0,
          ...(op.insets?.right !== undefined ? { right: op.insets.right } : {}),
          ...(op.insets?.bottom !== undefined ? { bottom: op.insets.bottom } : {}),
        },
        diagnostics: [],
      };
    }
  }
}

/**
 * Plans a semantic style edit across a selection: derives each node's raw
 * patch, normalizes and flex-repairs it PER NODE (against that node's own
 * parent context), validates against the node type's schema, drops no-op keys
 * (values already effective), and picks the write discipline the adapter must
 * use. Pure — executing the plan against the document is the adapter's job.
 */
export function planStyleEdit(
  op: StyleEditOp,
  targets: readonly StyleTargetView[],
  options: PlanOptions = {},
): StyleWritePlan {
  const nodes: NodeWritePlan[] = [];
  const planDiagnostics: StyleDiagnostic[] = [];

  for (const view of targets) {
    const { patch: opPatch, diagnostics: opDiagnostics } = opPatchFor(op, view, options);
    const diagnostics: StyleDiagnostic[] = [...opDiagnostics];

    const { patch: normalized, diagnostics: normalizeDiagnostics } = normalizeStylePatch(
      view.nodeType,
      opPatch,
      { nodeId: view.nodeId },
    );
    diagnostics.push(...normalizeDiagnostics);

    const { patch: repaired, diagnostics: repairDiagnostics } = repairFlexSizing(
      normalized,
      view,
      view.nodeId,
    );
    diagnostics.push(...repairDiagnostics);

    const validation = validateStylePatch(view.nodeType, repaired, view.nodeId);
    diagnostics.push(...validation);

    const blocked = diagnostics.some((diagnostic) => diagnostic.severity === "error");
    const patch = blocked ? {} : dropNoOpKeys(repaired, view);

    const structured = Object.values(patch).some(isPlainStructuredValue);
    const stateHasStructured =
      view.stateOverrides !== undefined &&
      Object.keys(patch).some((key) => isPlainStructuredValue(view.stateOverrides?.[key]));

    nodes.push({
      nodeId: view.nodeId,
      patch,
      layer: view.stateId !== undefined ? { kind: "state", stateId: view.stateId } : { kind: "base" },
      discipline: structured || stateHasStructured ? "whole-set" : "merge-update",
      diagnostics,
    });
  }

  const empty = nodes.every((node) => Object.keys(node.patch).length === 0);
  return { nodes, diagnostics: planDiagnostics, empty };
}

function styleValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Drops keys whose value already equals the node's effective style — unless the
 * write targets a state layer and the key currently carries an override that
 * the equal-to-base value should clear (matching the designer's override-clear
 * discipline).
 */
function dropNoOpKeys(patch: StylePatch, view: StyleTargetView): StylePatch {
  const result: StylePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    const clearsOverride =
      view.stateId !== undefined &&
      view.stateOverrides !== undefined &&
      key in view.stateOverrides &&
      styleValuesEqual(value, view.baseStyle[key]);
    if (!styleValuesEqual(value, view.style[key]) || clearsOverride) {
      result[key] = value;
    }
  }
  return result;
}
