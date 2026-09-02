import type { NodeType } from "@voidhash/mimic-schema";

import {
  acceptanceOf,
  nodeStyleFields,
  styleFieldSchema,
  unwrapEntriesDeep,
} from "./introspection.ts";
import { warningDiagnostic, type StyleDiagnostic } from "./diagnostics.ts";
import type { ParentFlexContext, StylePatch } from "./model.ts";

/**
 * Maps each RENDERER-GATED style field to the `*Enabled` flag that gates its
 * group. The renderer draws a background / border / shadow / path fill / stroke
 * only when the group's flag is on, but the flags default to `false` — so
 * setting `backgroundColor` without the flag renders nothing. The engine
 * auto-enables a group whenever any of its fields is written.
 *
 * The four `border*Radius` fields are DELIBERATELY ABSENT: border radius is
 * ungated in the renderer, so rounding a corner must not switch on the
 * separately gated border stroke. The compile contract test pins this map to
 * the live style schema.
 */
export const STYLE_GROUP_FLAG_BY_FIELD: Readonly<Record<string, string>> = {
  backgroundColor: "backgroundEnabled",
  backgroundType: "backgroundEnabled",
  backgroundGradient: "backgroundEnabled",
  backgroundImage: "backgroundEnabled",
  borderTopWidth: "borderEnabled",
  borderRightWidth: "borderEnabled",
  borderBottomWidth: "borderEnabled",
  borderLeftWidth: "borderEnabled",
  borderColor: "borderEnabled",
  borderStyle: "borderEnabled",
  shadowColor: "shadowEnabled",
  shadowOffsetX: "shadowEnabled",
  shadowOffsetY: "shadowEnabled",
  shadowRadius: "shadowEnabled",
  shadowOpacity: "shadowEnabled",
  fillColor: "fillEnabled",
  fillRule: "fillEnabled",
  fillOpacity: "fillEnabled",
  strokeColor: "strokeEnabled",
  strokeWidth: "strokeEnabled",
  strokeOpacity: "strokeEnabled",
  strokeLinecap: "strokeEnabled",
  strokeLinejoin: "strokeEnabled",
};

/** Style fields whose CSS rejects negative values — clamped up to 0 on write. */
const NON_NEGATIVE_FIELDS: ReadonlySet<string> = new Set([
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "shadowRadius",
  "strokeWidth",
  "fontSize",
]);

/** Style fields semantically bounded to the `[0, 1]` range. */
const UNIT_INTERVAL_FIELDS: ReadonlySet<string> = new Set([
  "opacity",
  "shadowOpacity",
  "fillOpacity",
  "strokeOpacity",
]);

/**
 * Normalizes a style patch into the exact shape the document accepts, repairing
 * what is repairable and reporting every repair as a warning diagnostic:
 *
 * - the legacy `null`-clear sentinel becomes `"auto"` for `width`/`height`
 *   (deleting them would re-materialize the schema default) and a field
 *   deletion (`undefined`) everywhere else;
 * - decoded CRDT array envelopes (`{ id, pos, value }`) are unwrapped so a
 *   snapshot value can be written back verbatim;
 * - out-of-range numbers are clamped (non-negative lengths, `[0, 1]`
 *   opacities, schema `min`/`max` validators);
 * - gated group fields derive their `*Enabled: true` flag (explicit wins).
 *
 * Pure and idempotent. Unknown fields pass through untouched — surfacing them
 * is {@link validateStylePatch}'s job.
 */
export function normalizeStylePatch(
  nodeType: NodeType,
  patch: Record<string, unknown>,
  options: { nodeId?: string } = {},
): { patch: StylePatch; diagnostics: StyleDiagnostic[] } {
  const diagnostics: StyleDiagnostic[] = [];
  const nodeId = options.nodeId;
  const normalized: StylePatch = {};

  for (const [field, rawValue] of Object.entries(patch)) {
    let value: unknown = rawValue;

    if (value === null) {
      value = field === "width" || field === "height" ? "auto" : undefined;
    }

    if (value !== null && typeof value === "object") {
      value = unwrapEntriesDeep(value);
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const clamped = clampNumber(nodeType, field, value);
      if (clamped !== value) {
        diagnostics.push(
          warningDiagnostic(
            "constraint-violation",
            `"${field}" value ${value} clamped to ${clamped}`,
            { nodeId, field, normalizedValue: clamped },
          ),
        );
        value = clamped;
      }
    }

    normalized[field] = value;
  }

  const withFlags = withDerivedEnabledFlags(nodeType, normalized);
  for (const flag of Object.keys(withFlags)) {
    if (!(flag in normalized)) {
      diagnostics.push(
        warningDiagnostic("enabled-flag-derived", `"${flag}" derived on by a gated field write`, {
          nodeId,
          field: flag,
          normalizedValue: true,
        }),
      );
    }
  }

  return { patch: withFlags, diagnostics };
}

function clampNumber(nodeType: NodeType, field: string, value: number): number {
  let result = value;
  if (NON_NEGATIVE_FIELDS.has(field) && result < 0) {
    result = 0;
  }
  if (UNIT_INTERVAL_FIELDS.has(field)) {
    result = Math.min(1, Math.max(0, result));
  }
  const schema = styleFieldSchema(nodeType, field);
  if (schema !== undefined) {
    const acc = acceptanceOf(schema);
    if (acc.min !== undefined && result < acc.min) result = acc.min;
    if (acc.max !== undefined && result > acc.max) result = acc.max;
  }
  return result;
}

/**
 * Inject `<group>Enabled: true` for every gated group with at least one field
 * present in `patch`. A flag is injected only when it is a legal style field of
 * `nodeType` and absent from the patch — an explicit flag value always wins.
 * Returns the same reference when there is nothing to add.
 */
export function withDerivedEnabledFlags(nodeType: NodeType, patch: StylePatch): StylePatch {
  const legalFields = nodeStyleFields(nodeType);
  const flagsToAdd = new Set<string>();
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const flag = STYLE_GROUP_FLAG_BY_FIELD[key];
    if (flag === undefined) continue;
    if (Object.prototype.hasOwnProperty.call(patch, flag)) continue;
    if (!legalFields.includes(flag)) continue;
    flagsToAdd.add(flag);
  }
  if (flagsToAdd.size === 0) return patch;
  const next = { ...patch };
  for (const flag of flagsToAdd) next[flag] = true;
  return next;
}

interface FlexSizingView {
  readonly style: Record<string, unknown>;
  readonly parent: ParentFlexContext | null;
}

/**
 * Repairs conflicting flex-sizing combinations in a patch, PER NODE (the legacy
 * designer helper derived the repair from the first selected node only and
 * applied it to all — wrong across mixed parent directions):
 *
 * - a numeric CROSS-axis size defeats stretch, so an explicit
 *   `alignSelf: "stretch"` clears to `"auto"` (container-driven stretch via
 *   `alignSelf: "auto"` is left alone — the numeric size already wins);
 * - a numeric MAIN-axis size conflicts with `flex`, which is deleted.
 *
 * Returns the input patch reference when nothing needed repair.
 */
export function repairFlexSizing(
  patch: StylePatch,
  view: FlexSizingView,
  nodeId?: string,
): { patch: StylePatch; diagnostics: StyleDiagnostic[] } {
  const parent = view.parent;
  if (parent === null) return { patch, diagnostics: [] };

  const diagnostics: StyleDiagnostic[] = [];
  let result = patch;

  const repair = (axis: "width" | "height") => {
    if (typeof patch[axis] !== "number") return;
    const crossAxisDirection = axis === "width" ? "column" : "row";
    if (parent.direction === crossAxisDirection) {
      const alignSelf = "alignSelf" in result ? result["alignSelf"] : view.style["alignSelf"];
      if (alignSelf === "stretch") {
        result = { ...result, alignSelf: "auto" };
        diagnostics.push(
          warningDiagnostic(
            "sizing-conflict-repaired",
            `fixed ${axis} defeats stretch; alignSelf cleared to "auto"`,
            { nodeId, field: "alignSelf", normalizedValue: "auto" },
          ),
        );
      }
    } else {
      const flex = "flex" in result ? result["flex"] : view.style["flex"];
      if (flex !== undefined && flex !== null) {
        result = { ...result, flex: undefined };
        diagnostics.push(
          warningDiagnostic(
            "sizing-conflict-repaired",
            `fixed ${axis} conflicts with flex on the main axis; flex deleted`,
            { nodeId, field: "flex", normalizedValue: undefined },
          ),
        );
      }
    }
  };

  repair("width");
  repair("height");

  return { patch: result, diagnostics };
}
