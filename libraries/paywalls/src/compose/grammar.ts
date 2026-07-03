/**
 * The composition grammar's style/tag vocabulary.
 *
 * The closed `paywall-composition` package used to introspect the real mimic
 * node schemas (`ViewNode`/`ScreenNode`/`TextNode`) to discover the legal style
 * fields and their defaults. The OSS grammar must be mimic-free, so the
 * vocabulary is single-sourced from the dependency-free `../schema/style-registry`
 * (per-node ORDERED field lists with defaults, derived once from the mimic node
 * schemas). Importing that registry keeps this module mimic/react/runtime-free.
 * A mono-side contract test
 * (`paywall-composition/src/vocabulary-contract.test.ts`) asserts the derived
 * `NODE_STYLE_VOCABULARY` matches the live mimic node schemas so drift is caught
 * at CI time.
 */
import { NODE_DEFAULT_NAMES, NODE_STYLE_ENTRIES } from "../schema/style-registry";

/**
 * The subset of mimic node types the composition format currently round-trips.
 * Shape/Path/Component follow the same mechanics and are a documented next
 * increment.
 */
export type CompositionNodeType = "screen" | "view" | "text";

export const TAG_TO_TYPE: Record<string, CompositionNodeType> = {
  Screen: "screen",
  View: "view",
  Text: "text",
};

export const TYPE_TO_TAG: Record<CompositionNodeType, string> = {
  screen: "Screen",
  view: "View",
  text: "Text",
};

/**
 * The style vocabulary of a node type: the set of legal style field names, the
 * default value for each (values equal to a default are omitted on print), and
 * the default display name. Encoded explicitly — mirrors the mimic node schema
 * (see the module doc). The `styleFields` array order is the mimic schema field
 * order and must be preserved: the printer emits attributes in this order.
 */
export interface NodeStyleVocabulary {
  readonly styleFields: readonly string[];
  readonly defaultStyle: Readonly<Record<string, unknown>>;
  readonly defaultName: string;
}

/**
 * Ground-truth per-node style vocabulary, derived from the shared
 * `../schema/style-registry` per-node ordered field lists (themselves derived
 * once from the mimic node schemas — `prim.data.schema.fields.style.fields` for
 * the field set + order and `prim.data.decode(prim.data.encode({}))` for
 * defaults). Kept in lockstep with mimic by the mono vocabulary contract test.
 * A field entry with no `default` contributes to `styleFields` (fixing its
 * printer position) but is omitted from `defaultStyle`.
 */
const buildVocabulary = (type: CompositionNodeType): NodeStyleVocabulary => {
  const entries = NODE_STYLE_ENTRIES[type];
  const defaultStyle: Record<string, unknown> = {};
  for (const entry of entries) {
    if ("default" in entry) {
      defaultStyle[entry.field] = entry.default;
    }
  }
  return {
    styleFields: entries.map((entry) => entry.field),
    defaultStyle,
    defaultName: NODE_DEFAULT_NAMES[type],
  };
};

export const NODE_STYLE_VOCABULARY: Record<CompositionNodeType, NodeStyleVocabulary> = {
  screen: buildVocabulary("screen"),
  view: buildVocabulary("view"),
  text: buildVocabulary("text"),
};

/** The legal style field set for a node type (from {@link NODE_STYLE_VOCABULARY}). */
export function styleFieldsOf(type: CompositionNodeType): ReadonlySet<string> {
  return new Set(NODE_STYLE_VOCABULARY[type].styleFields);
}

/** Resolve a source attribute name to a style field, or null if not a style. */
export function styleFieldFor(type: CompositionNodeType, attr: string): string | null {
  return styleFieldsOf(type).has(attr) ? attr : null;
}
