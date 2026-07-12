import {
  CodeComponentNode,
  ComponentNode,
  LibraryNode,
  PathNode,
  RootNode,
  ScreenNode,
  ScrollViewNode,
  ShapeNode,
  TextNode,
  ViewNode,
  type NodeType,
} from "@voidhash/mimic-schema";

/**
 * Schema-derived introspection over the live mimic node primitives. This module
 * is the SINGLE place the AI document-edit vocabulary reads the legal shape of a
 * node from: the set of data fields per node type, the accepted value family of
 * each field, and the defaults-filled snapshot. Deriving everything from the
 * mimic schemas (never hand-listing it) is what keeps the AI edit surface from
 * drifting away from what the designer can actually persist — the same drift the
 * document-first authoring redesign kills.
 *
 * The mimic `Primitive` schema serializes to a discriminated union on `kind`
 * (`string | number | boolean | literal | either | object | array | ...`); we
 * only touch the members reachable from node data, typed loosely below.
 */

/** The serialized form of a mimic schema field, as read off `prim.data.schema`. */
export type SerializedSchema =
  | { kind: "number"; default?: unknown; validators?: readonly SerializedValidator[] }
  | { kind: "boolean"; default?: unknown }
  | { kind: "string"; default?: unknown; validators?: readonly SerializedValidator[] }
  | { kind: "literal"; value: string | number | boolean; default?: unknown }
  | { kind: "either"; variants: readonly SerializedSchema[]; default?: unknown }
  | { kind: "object"; fields: Record<string, SerializedSchema>; default?: unknown }
  | { kind: "array"; element: SerializedSchema; default?: unknown }
  | { kind: string; [extra: string]: unknown };

/** One serialized validator (`regex`, `min`, `max`, `int`, …) on a scalar field. */
export interface SerializedValidator {
  readonly kind: string;
  readonly pattern?: string;
  readonly flags?: string;
  readonly value?: number;
}

/**
 * The mimic node primitives keyed by node type. Typed loosely (`any`): the
 * primitives carry deep generic types and we only read `.data.schema`,
 * `.data.encode`, `.data.decode`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_PRIMS: Record<NodeType, any> = {
  root: RootNode,
  screen: ScreenNode,
  view: ViewNode,
  scrollView: ScrollViewNode,
  text: TextNode,
  shape: ShapeNode,
  path: PathNode,
  component: ComponentNode,
  library: LibraryNode,
  codeComponent: CodeComponentNode,
};

/** The node types the AI vocabulary is allowed to introspect / build. */
export function nodePrim(type: NodeType): unknown {
  return NODE_PRIMS[type];
}

/** The serialized `data` struct schema (`{ kind: "object", fields }`) for a node type. */
export function nodeDataSchema(type: NodeType): { fields: Record<string, SerializedSchema> } {
  return NODE_PRIMS[type].data.schema as { fields: Record<string, SerializedSchema> };
}

/** The serialized schema of one top-level data field (e.g. `name`, `text`, `style`) of a node type. */
export function nodeDataFieldSchema(type: NodeType, field: string): SerializedSchema | undefined {
  return nodeDataSchema(type).fields[field];
}

/** The ordered set of legal top-level data field names for a node type. */
export function nodeDataFields(type: NodeType): readonly string[] {
  return Object.keys(nodeDataSchema(type).fields);
}

/** The serialized `style` sub-struct schema for a node type, or `undefined` if it has no style. */
export function nodeStyleSchema(
  type: NodeType,
): { fields: Record<string, SerializedSchema> } | undefined {
  const style = nodeDataSchema(type).fields["style"];
  return style && "fields" in style
    ? (style as { fields: Record<string, SerializedSchema> })
    : undefined;
}

/** The ordered set of legal style field names for a node type (empty if it has no style). */
export function nodeStyleFields(type: NodeType): readonly string[] {
  return Object.keys(nodeStyleSchema(type)?.fields ?? {});
}

/**
 * Recursively strip mimic CRDT array envelopes from a decoded value: an array
 * element is an ordered CRDT entry `{ id, pos, value }`; the logical value is the
 * `value` payload. Only that envelope layer is removed. Mirrors the helper in the
 * OSS vocabulary-contract test and `replay.ts`.
 */
export function unwrapEntries(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item !== null &&
      typeof item === "object" &&
      "value" in item &&
      "id" in item &&
      "pos" in item
        ? unwrapEntries((item as { value: unknown }).value)
        : unwrapEntries(item),
    );
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = unwrapEntries(item);
    }
    return out;
  }
  return value;
}

const defaultsCache = new Map<NodeType, Record<string, unknown>>();

/**
 * The defaults-filled, envelope-unwrapped `data` snapshot for a node type,
 * computed via `prim.data.decode(prim.data.encode({}))` (the proven path from the
 * vocabulary-contract test) and cached per type. Used to strip default-equal
 * fields when serializing a document for the model.
 *
 * A node type with a REQUIRED-no-default field (`codeComponent.path`,
 * `component.componentSlug`, …) cannot encode an empty `{}` — the encode throws.
 * Those types have no meaningful "default snapshot" to strip against, so the
 * computation degrades to an empty defaults map (nothing is stripped; every
 * authored field is kept), keeping the serializer robust over WHOLE documents
 * (which include `library`/`codeComponent`/`component` nodes).
 */
export function nodeDefaultData(type: NodeType): Record<string, unknown> {
  const cached = defaultsCache.get(type);
  if (cached) return cached;
  const prim = NODE_PRIMS[type];
  let unwrapped: Record<string, unknown>;
  try {
    const decoded = prim.data.decode(prim.data.encode({})) as Record<string, unknown>;
    unwrapped = unwrapEntries(decoded) as Record<string, unknown>;
  } catch {
    unwrapped = {};
  }
  defaultsCache.set(type, unwrapped);
  return unwrapped;
}

/**
 * The normalized set of scalar values a serialized schema accepts, so a
 * user-supplied value can be checked against it AND a good error derived without
 * hand-listing anything. Mirrors the acceptance model of the OSS
 * vocabulary-contract test.
 */
export interface Acceptance {
  /** A plain finite number is legal. */
  acceptsNumber: boolean;
  /** A boolean is legal. */
  acceptsBoolean: boolean;
  /** An arbitrary (or regex-constrained) string is legal. */
  acceptsString: boolean;
  /** The exact string/number/boolean literal set, when the field is a closed union of literals. */
  literals: readonly (string | number | boolean)[];
  /** The field is an object/array (structured) — validated by descending into its shape. */
  isStructured: boolean;
  /** Regex validators the string must satisfy (compiled lazily at validation time). */
  regexes: readonly { pattern: string; flags?: string }[];
}

const EMPTY_ACCEPTANCE: Acceptance = {
  acceptsNumber: false,
  acceptsBoolean: false,
  acceptsString: false,
  literals: [],
  isStructured: false,
  regexes: [],
};

/** Compute the accepted value family of a serialized schema (recursing into `either`). */
export function acceptanceOf(schema: SerializedSchema): Acceptance {
  // `SerializedSchema` carries an open fallback member (`{ kind: string; ... }`)
  // so unknown mimic schema kinds don't break the union; that widens the
  // per-member fields, so we read them off a loosely-typed view after switching.
  const s = schema as {
    kind: string;
    value?: string | number | boolean;
    variants?: readonly SerializedSchema[];
    validators?: readonly SerializedValidator[];
  };
  switch (s.kind) {
    case "number":
      return { ...EMPTY_ACCEPTANCE, acceptsNumber: true };
    case "boolean":
      return { ...EMPTY_ACCEPTANCE, acceptsBoolean: true };
    case "string": {
      const regexes = (s.validators ?? [])
        .filter((v) => v.kind === "regex" && typeof v.pattern === "string")
        .map((v) => ({ pattern: v.pattern as string, flags: v.flags }));
      return { ...EMPTY_ACCEPTANCE, acceptsString: true, regexes };
    }
    case "literal":
      return { ...EMPTY_ACCEPTANCE, literals: s.value !== undefined ? [s.value] : [] };
    case "either": {
      const merged = (s.variants ?? []).map(acceptanceOf);
      return {
        acceptsNumber: merged.some((m) => m.acceptsNumber),
        acceptsBoolean: merged.some((m) => m.acceptsBoolean),
        acceptsString: merged.some((m) => m.acceptsString),
        literals: merged.flatMap((m) => m.literals),
        isStructured: merged.some((m) => m.isStructured),
        regexes: merged.flatMap((m) => m.regexes),
      };
    }
    case "object":
    case "array":
      return { ...EMPTY_ACCEPTANCE, isStructured: true };
    default:
      // Unknown/unsupported kind — treat as structured so we don't reject it on a
      // scalar-family basis (validation of unknown kinds is a no-op by design).
      return { ...EMPTY_ACCEPTANCE, isStructured: true };
  }
}

/**
 * A human/model-readable one-word summary of the value family a serialized schema
 * expects, for "expected <type>" error messages. Enum fields render their literal
 * set at the call site (see `document-edits`), so this returns the scalar family.
 */
export function expectedTypeLabel(schema: SerializedSchema): string {
  const acc = acceptanceOf(schema);
  if (acc.literals.length > 0 && !acc.acceptsNumber && !acc.acceptsBoolean && !acc.acceptsString) {
    return "enum";
  }
  if (acc.isStructured) return "object";
  const families: string[] = [];
  if (acc.acceptsNumber) families.push("number");
  if (acc.acceptsString) families.push("string");
  if (acc.acceptsBoolean) families.push("boolean");
  if (acc.literals.length > 0) families.push("literal");
  return families.join(" | ") || "unknown";
}
