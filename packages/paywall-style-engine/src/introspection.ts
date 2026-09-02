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
 * Schema-derived introspection over the live mimic node primitives. The engine
 * reads the legal style vocabulary of every node type from here — the set of
 * style fields, the accepted value family per field, scalar constraints, and the
 * defaults-filled style snapshot. Everything is derived from the mimic schemas
 * (never hand-listed) so the engine cannot drift from what the document can
 * actually persist.
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

// Typed loosely (`any`): the primitives carry deep generic types and we only
// read `.data.schema`, `.data.encode`, `.data.decode`.
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

/** A serialized schema that carries a `fields` map (an object/struct schema). */
export interface FieldsSchema {
  fields: Record<string, SerializedSchema>;
}

function hasFields(
  schema: SerializedSchema | undefined,
): schema is SerializedSchema & FieldsSchema {
  return schema !== undefined && "fields" in schema;
}

/** The serialized `style` sub-struct schema for a node type, or `undefined` if it has no style. */
export function nodeStyleSchema(type: NodeType): FieldsSchema | undefined {
  const style: SerializedSchema | undefined = NODE_PRIMS[type].data.schema.fields["style"];
  if (hasFields(style)) return style;
  return undefined;
}

/** The serialized schema of one style field of a node type, or `undefined` when illegal. */
export function styleFieldSchema(type: NodeType, field: string): SerializedSchema | undefined {
  return nodeStyleSchema(type)?.fields[field];
}

const styleFieldsCache = new Map<NodeType, readonly string[]>();

/** The ordered set of legal style field names for a node type (empty if it has no style). */
export function nodeStyleFields(type: NodeType): readonly string[] {
  const cached = styleFieldsCache.get(type);
  if (cached) return cached;
  const fields = Object.keys(nodeStyleSchema(type)?.fields ?? {});
  styleFieldsCache.set(type, fields);
  return fields;
}

const defaultStyleCache = new Map<NodeType, Record<string, unknown>>();

/**
 * The defaults-filled, envelope-unwrapped style snapshot for a node type,
 * computed via `prim.data.decode(prim.data.encode({}))` and cached. Node types
 * whose data cannot encode empty (required-no-default fields) degrade to an
 * empty record.
 */
export function nodeDefaultStyle(type: NodeType): Record<string, unknown> {
  const cached = defaultStyleCache.get(type);
  if (cached) return cached;
  const prim = NODE_PRIMS[type];
  let style: Record<string, unknown> = {};
  try {
    const decoded: Record<string, unknown> = prim.data.decode(prim.data.encode({}));
    const decodedStyle = decoded["style"];
    if (decodedStyle !== null && typeof decodedStyle === "object") {
      style = unwrapEntriesDeep(decodedStyle) as Record<string, unknown>;
    }
  } catch {
    style = {};
  }
  defaultStyleCache.set(type, style);
  return style;
}

/**
 * The normalized set of scalar values a serialized schema accepts, plus its
 * numeric bounds, so a value can be checked and a precise diagnostic derived
 * without hand-listing anything.
 */
export interface Acceptance {
  acceptsNumber: boolean;
  acceptsBoolean: boolean;
  acceptsString: boolean;
  /** The exact literal set, when the field is (or includes) literals. */
  literals: readonly (string | number | boolean)[];
  /** The field is an object/array (structured) — validated by descending into its shape. */
  isStructured: boolean;
  /** Regex validators the string must satisfy. */
  regexes: readonly { pattern: string; flags?: string }[];
  /** Inclusive numeric lower bound, when a `min` validator is declared. */
  min?: number;
  /** Inclusive numeric upper bound, when a `max` validator is declared. */
  max?: number;
}

const EMPTY_ACCEPTANCE: Acceptance = {
  acceptsNumber: false,
  acceptsBoolean: false,
  acceptsString: false,
  literals: [],
  isStructured: false,
  regexes: [],
};

function validatorsOf(schema: SerializedSchema): readonly SerializedValidator[] {
  if (!("validators" in schema) || !Array.isArray(schema.validators)) return [];
  return schema.validators;
}

function variantsOf(schema: SerializedSchema): readonly SerializedSchema[] {
  if (!("variants" in schema) || !Array.isArray(schema.variants)) return [];
  return schema.variants;
}

function literalsOf(schema: SerializedSchema): readonly (string | number | boolean)[] {
  if (!("value" in schema)) return [];
  const value = schema.value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [value];
  }
  return [];
}

/** Compute the accepted value family of a serialized schema (recursing into `either`). */
export function acceptanceOf(schema: SerializedSchema): Acceptance {
  switch (schema.kind) {
    case "number": {
      const bounds: Pick<Acceptance, "min" | "max"> = {};
      for (const validator of validatorsOf(schema)) {
        if (validator.kind === "min" && typeof validator.value === "number") {
          bounds.min = validator.value;
        }
        if (validator.kind === "max" && typeof validator.value === "number") {
          bounds.max = validator.value;
        }
      }
      return { ...EMPTY_ACCEPTANCE, acceptsNumber: true, ...bounds };
    }
    case "boolean":
      return { ...EMPTY_ACCEPTANCE, acceptsBoolean: true };
    case "string": {
      const regexes = validatorsOf(schema).flatMap((validator) => {
        if (validator.kind !== "regex" || typeof validator.pattern !== "string") return [];
        return [{ pattern: validator.pattern, flags: validator.flags }];
      });
      return { ...EMPTY_ACCEPTANCE, acceptsString: true, regexes };
    }
    case "literal":
      return { ...EMPTY_ACCEPTANCE, literals: literalsOf(schema) };
    case "either": {
      const merged = variantsOf(schema).map(acceptanceOf);
      return {
        acceptsNumber: merged.some((m) => m.acceptsNumber),
        acceptsBoolean: merged.some((m) => m.acceptsBoolean),
        acceptsString: merged.some((m) => m.acceptsString),
        literals: merged.flatMap((m) => m.literals),
        isStructured: merged.some((m) => m.isStructured),
        regexes: merged.flatMap((m) => m.regexes),
        min: merged.find((m) => m.min !== undefined)?.min,
        max: merged.find((m) => m.max !== undefined)?.max,
      };
    }
    case "object":
    case "array":
      return { ...EMPTY_ACCEPTANCE, isStructured: true };
    default:
      return { ...EMPTY_ACCEPTANCE, isStructured: true };
  }
}

/** A human-readable one-word summary of the value family a schema expects. */
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

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isEntryEnvelope(item: unknown): item is { value: unknown } {
  return isObjectLike(item) && "value" in item && "id" in item && "pos" in item;
}

/**
 * Recursively strip mimic CRDT array envelopes from a decoded value: an array
 * element is an ordered CRDT entry `{ id, pos, value }`; the logical value is
 * the `value` payload. Every write that replays a decoded snapshot must run
 * through this, or struct re-encodes collapse array elements to defaults.
 */
export function unwrapEntriesDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      isEntryEnvelope(item) ? unwrapEntriesDeep(item.value) : unwrapEntriesDeep(item),
    );
  }
  if (isObjectLike(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = unwrapEntriesDeep(item);
    }
    return out;
  }
  return value;
}
