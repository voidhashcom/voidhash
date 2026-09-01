import { isNodeType } from "@voidhash/mimic-schema";

import { nodeStyleFields } from "./mimic-introspection.ts";
import type { NodeInput } from "./surfaces.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as HashSet from "effect/HashSet";

/**
 * Maps each RENDERER-GATED style field to the `*Enabled` flag that gates its
 * group. The renderer draws a background / border / shadow / path fill / stroke
 * only when the group's flag is on (`background.ts`, `view-styles.ts`,
 * `path-styles.ts`), but the flags default to `false` and are designer-only
 * toggles — so a model that sets `backgroundColor` without knowing about the flag
 * would see nothing render. On the AI edit path we therefore auto-enable a group
 * whenever any of its fields is set (see {@link withDerivedEnabledFlags}).
 *
 * The four `border*Radius` fields are DELIBERATELY ABSENT: border radius is
 * ungated in the renderer, so rounding a corner must not switch on the separately
 * gated border stroke. A schema-contract test (`style-group-flags.test.ts`) pins
 * this map to the live style schema, so a new gated field forces a conscious edit.
 */
export const STYLE_GROUP_FLAG_BY_FIELD: Readonly<Record<string, string>> = {
  // Background → backgroundEnabled
  backgroundColor: "backgroundEnabled",
  backgroundType: "backgroundEnabled",
  backgroundGradient: "backgroundEnabled",
  backgroundImage: "backgroundEnabled",
  // Border stroke → borderEnabled (border*Radius excluded — ungated in the renderer)
  borderTopWidth: "borderEnabled",
  borderRightWidth: "borderEnabled",
  borderBottomWidth: "borderEnabled",
  borderLeftWidth: "borderEnabled",
  borderColor: "borderEnabled",
  borderStyle: "borderEnabled",
  // Shadow → shadowEnabled
  shadowColor: "shadowEnabled",
  shadowOffsetX: "shadowEnabled",
  shadowOffsetY: "shadowEnabled",
  shadowRadius: "shadowEnabled",
  shadowOpacity: "shadowEnabled",
  // Path fill → fillEnabled
  fillColor: "fillEnabled",
  fillRule: "fillEnabled",
  fillOpacity: "fillEnabled",
  // Path stroke → strokeEnabled
  strokeColor: "strokeEnabled",
  strokeWidth: "strokeEnabled",
  strokeOpacity: "strokeEnabled",
  strokeLinecap: "strokeEnabled",
  strokeLinejoin: "strokeEnabled",
};

/** A non-null, non-array object (a mimic `style` / update `set` shape). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && P.isObject(value) && !Array.isArray(value);
}

/**
 * Inject `<group>Enabled: true` into a `style` object for every gated group that
 * has at least one field present, so the AI edit path renders what the model set.
 *
 * A flag is injected ONLY when it is a legal style field of `type` (per
 * {@link nodeStyleFields}) AND absent from `style`. An EXPLICIT flag value always
 * wins — writing `backgroundEnabled: false` alongside `backgroundColor` keeps the
 * group hidden. The function is pure and idempotent: it never mutates `style` and
 * returns the SAME reference when there is nothing to add (an unknown `type`, no
 * gated fields, or every relevant flag already present).
 */
export function withDerivedEnabledFlags(
  type: string,
  style: Record<string, unknown>,
): Record<string, unknown> {
  if (!isNodeType(type)) return style;
  const legalFields = nodeStyleFields(type);
  const flagsToAdd = Arr.reduce(R.keys(style), HashSet.empty<string>(), (flags, key) => {
    const flag = STYLE_GROUP_FLAG_BY_FIELD[key];
    if (flag === undefined) return flags;
    if (Object.prototype.hasOwnProperty.call(style, flag)) return flags;
    if (!legalFields.includes(flag)) return flags;
    return HashSet.add(flags, flag);
  });
  if (HashSet.size(flagsToAdd) === 0) return style;
  return HashSet.reduce(flagsToAdd, { ...style }, (next, flag) => ({ ...next, [flag]: true }));
}

/**
 * Apply {@link withDerivedEnabledFlags} to a `NodeInput`'s `style` and recurse
 * into its `children` (each child judged by its OWN node type). Pure: returns the
 * same node reference when neither the style nor any child changed, and passes
 * nodes with an unknown/unstyled type through untouched.
 */
export function deriveEnabledFlagsForNodeInput(node: NodeInput): NodeInput {
  const style = node.style;
  const nextStyle = derivedStyleOf(node.type, style);

  const children = node.children;
  const nextChildren = children?.map(deriveEnabledFlagsForNodeInput);
  const childrenChanged =
    children !== undefined &&
    nextChildren !== undefined &&
    nextChildren.some((child, index) => child !== children[index]);

  if (nextStyle === style && !childrenChanged) return node;
  const next: NodeInput = { ...node };
  if (nextStyle !== style) next.style = nextStyle;
  if (childrenChanged && nextChildren !== undefined) next.children = nextChildren;
  return next;
}

/**
 * {@link withDerivedEnabledFlags} applied to a node's raw `style` value: a
 * non-object style (absent, scalar, array) passes through by reference.
 */
function derivedStyleOf(type: string, style: unknown): unknown {
  if (!isPlainObject(style)) return style;
  return withDerivedEnabledFlags(type, style);
}

/**
 * Apply {@link withDerivedEnabledFlags} to an update `set`'s `style` field. A
 * no-op (returns the same `set` reference) when `set.style` is not a plain object
 * or nothing was injected.
 */
export function deriveEnabledFlagsForSet(
  type: string,
  set: Record<string, unknown>,
): Record<string, unknown> {
  const style = set.style;
  if (!isPlainObject(style)) return set;
  const nextStyle = withDerivedEnabledFlags(type, style);
  if (nextStyle === style) return set;
  return { ...set, style: nextStyle };
}
