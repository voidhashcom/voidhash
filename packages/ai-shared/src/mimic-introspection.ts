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
import * as Effect from "effect/Effect";
import { runSync } from "./runtime-boundary.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

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

/** A serialized schema that carries a `fields` map (an object/struct schema). */
export interface FieldsSchema {
  fields: Record<string, SerializedSchema>;
}

/** Whether a serialized schema carries a `fields` map (i.e. is a struct schema). */
function hasFields(schema: SerializedSchema | void): schema is SerializedSchema & FieldsSchema {
  return schema !== undefined && "fields" in schema;
}

/** The serialized `data` struct schema (`{ kind: "object", fields }`) for a node type. */
export function nodeDataSchema(type: NodeType): FieldsSchema {
  const schema: FieldsSchema = NODE_PRIMS[type].data.schema;
  return schema;
}

/** The serialized schema of one top-level data field (e.g. `name`, `text`, `style`) of a node type. */
export function nodeDataFieldSchema(type: NodeType, field: string): SerializedSchema | void {
  return nodeDataSchema(type).fields[field];
}

/** The ordered set of legal top-level data field names for a node type. */
export function nodeDataFields(type: NodeType): readonly string[] {
  return R.keys(nodeDataSchema(type).fields);
}

/** The serialized `style` sub-struct schema for a node type, or `undefined` if it has no style. */
export function nodeStyleSchema(type: NodeType): FieldsSchema | void {
  const style = nodeDataSchema(type).fields["style"];
  if (hasFields(style)) return style;
  return undefined;
}

/** The ordered set of legal style field names for a node type (empty if it has no style). */
export function nodeStyleFields(type: NodeType): readonly string[] {
  return R.keys(nodeStyleSchema(type)?.fields ?? {});
}

/**
 * Recursively strip mimic CRDT array envelopes from a decoded value: an array
 * element is an ordered CRDT entry `{ id, pos, value }`; the logical value is the
 * `value` payload. Only that envelope layer is removed. Mirrors the helper in the
 * OSS vocabulary-contract test and `replay.ts`.
 */
export function unwrapEntries(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(unwrapEntry);
  }
  if (isObjectLike(value)) {
    const out: Record<string, unknown> = {};
    Arr.forEach(R.toEntries(value), ([key, item]) => {
      out[key] = unwrapEntries(item);
    });
    return out;
  }
  return value;
}

/** A non-null object (arrays included — callers handle those first). */
function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && P.isObject(value);
}

/** Whether an array element is an ordered CRDT entry envelope `{ id, pos, value }`. */
function isEntryEnvelope(item: unknown): item is { value: unknown } {
  return isObjectLike(item) && "value" in item && "id" in item && "pos" in item;
}

/** Unwrap one array element: an entry envelope yields its payload, anything else recurses. */
function unwrapEntry(item: unknown): unknown {
  if (isEntryEnvelope(item)) return unwrapEntries(item.value);
  return unwrapEntries(item);
}

/** {@link unwrapEntries} over a record, preserving the record shape for callers. */
function unwrapRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Arr.forEach(R.toEntries(record), ([key, item]) => {
    out[key] = unwrapEntries(item);
  });
  return out;
}

const defaultsCache = MutableHashMap.empty<NodeType, Record<string, unknown>>();

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
  const cached = Option.getOrUndefined(MutableHashMap.get(defaultsCache, type));
  if (cached) return cached;
  const prim = NODE_PRIMS[type];
  // The encode of `{}` throws for node types with a REQUIRED-no-default field; those
  // degrade to an empty defaults map rather than failing the whole serialization.
  const unwrapped = runSync(
    Effect.try((): Record<string, unknown> => {
      const decoded: Record<string, unknown> = prim.data.decode(prim.data.encode({}));
      return unwrapRecord(decoded);
    }).pipe(Effect.orElseSucceed((): Record<string, unknown> => ({}))),
  );
  MutableHashMap.set(defaultsCache, type, unwrapped);
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

/** The `validators` of a serialized scalar schema, or `[]` when it declares none. */
function validatorsOf(schema: SerializedSchema): readonly SerializedValidator[] {
  if (!("validators" in schema) || !Array.isArray(schema.validators)) return [];
  return schema.validators;
}

/** The `variants` of a serialized `either` schema, or `[]` when it declares none. */
function variantsOf(schema: SerializedSchema): readonly SerializedSchema[] {
  if (!("variants" in schema) || !Array.isArray(schema.variants)) return [];
  return schema.variants;
}

/** The single literal of a serialized `literal` schema, or `[]` when it carries none. */
function literalsOf(schema: SerializedSchema): readonly (string | number | boolean)[] {
  if (!("value" in schema)) return [];
  const value = schema.value;
  if (P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return [value];
  }
  return [];
}

/** Compute the accepted value family of a serialized schema (recursing into `either`). */
export function acceptanceOf(schema: SerializedSchema): Acceptance {
  // `SerializedSchema` carries an open fallback member (`{ kind: string; ... }`)
  // so unknown mimic schema kinds don't break the union; that widens the
  // per-member fields, so the optional members are read through the guarded
  // accessors below rather than off the narrowed union.
  if (schema.kind === "number") return { ...EMPTY_ACCEPTANCE, acceptsNumber: true };
  if (schema.kind === "boolean") return { ...EMPTY_ACCEPTANCE, acceptsBoolean: true };
  if (schema.kind === "string") {
    const regexes = validatorsOf(schema).flatMap((validator) => {
      if (validator.kind !== "regex" || !P.isString(validator.pattern)) return [];
      return [{ pattern: validator.pattern, flags: validator.flags }];
    });
    return { ...EMPTY_ACCEPTANCE, acceptsString: true, regexes };
  }
  if (schema.kind === "literal") return { ...EMPTY_ACCEPTANCE, literals: literalsOf(schema) };
  if (schema.kind === "either") {
    const merged = variantsOf(schema).map(acceptanceOf);
    return {
      acceptsNumber: merged.some((m) => m.acceptsNumber),
      acceptsBoolean: merged.some((m) => m.acceptsBoolean),
      acceptsString: merged.some((m) => m.acceptsString),
      literals: merged.flatMap((m) => m.literals),
      isStructured: merged.some((m) => m.isStructured),
      regexes: merged.flatMap((m) => m.regexes),
    };
  }
  return { ...EMPTY_ACCEPTANCE, isStructured: true };
}

/**
 * A human/model-readable one-word summary of the value family a serialized schema
 * expects, for "expected <type>" error messages. Enum fields render their literal
 * set at the call site (see `document-edits`), so this returns the scalar family.
 */
export function expectedTypeLabel(schema: SerializedSchema): string {
  const acc = acceptanceOf(schema);
  if (
    Arr.isReadonlyArrayNonEmpty(acc.literals) &&
    !acc.acceptsNumber &&
    !acc.acceptsBoolean &&
    !acc.acceptsString
  ) {
    return "enum";
  }
  if (acc.isStructured) return "object";
  const families: string[] = [];
  if (acc.acceptsNumber) families.push("number");
  if (acc.acceptsString) families.push("string");
  if (acc.acceptsBoolean) families.push("boolean");
  if (Arr.isReadonlyArrayNonEmpty(acc.literals)) families.push("literal");
  return families.join(" | ") || "unknown";
}
