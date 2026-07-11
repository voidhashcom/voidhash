import type { ComponentPropDefinition } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentBoundAction, VariableTypeKey } from "@voidhash/mimic-schema";

/**
 * Fully-populated component prop value in the plain INPUT shape (inner
 * arrays plain, not `{id, pos, value}`-wrapped). Assignable to
 * `componentPropValueSchema`'s set input. An absent `productId` means "no
 * product selected" (the former `null` — the schema has no null values).
 */
export type ComponentPropValuePlain =
  | { key: "string"; value: string }
  | { key: "number"; value: number }
  | { key: "boolean"; value: boolean }
  | { key: "product"; value: { productId?: string } }
  | { key: "string-array"; value: readonly string[] }
  | { key: "number-array"; value: readonly number[] }
  | { key: "boolean-array"; value: readonly boolean[] };

/**
 * Fully-populated component prop binding. Assignable to
 * `componentPropBindingSchema`'s set input.
 */
export type ComponentPropBindingPlain =
  | { type: "literal"; value: ComponentPropValuePlain }
  | { type: "variable-reference"; value: { id: string } };

function asRecord(raw: unknown): Record<string, unknown> | undefined {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
}

/**
 * Unwraps a scalar array stored inside a component prop binding literal.
 * Bindings written through the union `set` passthrough store inner arrays
 * PLAIN, while schema-typed snapshots wrap entries as `{id, pos?, value}` —
 * both shapes must be readable (spec §3.1).
 */
export function unwrapScalarArray(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    const record = asRecord(item);
    if (record && typeof record.id === "string" && "value" in record) {
      return record.value;
    }
    return item;
  });
}

/** Reads a stored scalar array as strings, dropping entries of other types. */
export function readStringArray(raw: unknown): string[] {
  return unwrapScalarArray(raw).filter((item): item is string => typeof item === "string");
}

/** Reads a stored scalar array as numbers, dropping entries of other types. */
export function readNumberArray(raw: unknown): number[] {
  return unwrapScalarArray(raw).filter((item): item is number => typeof item === "number");
}

/** Reads a stored scalar array as booleans, dropping entries of other types. */
export function readBooleanArray(raw: unknown): boolean[] {
  return unwrapScalarArray(raw).filter((item): item is boolean => typeof item === "boolean");
}

/**
 * Defensively converts a raw stored component prop value (state or snapshot,
 * with plain or entry-wrapped inner arrays) into the schema set input.
 * Returns `undefined` for unrecognized shapes.
 */
export function componentPropValueFromRaw(raw: unknown): ComponentPropValuePlain | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }
  switch (record.key) {
    case "string":
      return typeof record.value === "string" ? { key: "string", value: record.value } : undefined;
    case "number":
      return typeof record.value === "number" ? { key: "number", value: record.value } : undefined;
    case "boolean":
      return typeof record.value === "boolean"
        ? { key: "boolean", value: record.value }
        : undefined;
    case "product": {
      const value = asRecord(record.value);
      if (!value) {
        return undefined;
      }
      const productId = value.productId;
      if (typeof productId === "string") {
        return { key: "product", value: { productId } };
      }
      // null (legacy stored shape) and absence both mean "no product selected".
      if (productId === null || productId === undefined) {
        return { key: "product", value: {} };
      }
      return undefined;
    }
    case "string-array":
      return { key: "string-array", value: readStringArray(record.value) };
    case "number-array":
      return { key: "number-array", value: readNumberArray(record.value) };
    case "boolean-array":
      return { key: "boolean-array", value: readBooleanArray(record.value) };
    default:
      return undefined;
  }
}

/**
 * Defensively converts a raw stored component prop binding into the schema
 * set input, normalizing inner arrays to the plain shape.
 */
export function componentPropBindingFromRaw(raw: unknown): ComponentPropBindingPlain | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }
  if (record.type === "literal") {
    const value = componentPropValueFromRaw(record.value);
    return value === undefined ? undefined : { type: "literal", value };
  }
  if (record.type === "variable-reference") {
    const value = asRecord(record.value);
    if (value && typeof value.id === "string") {
      return { type: "variable-reference", value: { id: value.id } };
    }
    return undefined;
  }
  return undefined;
}

/**
 * Defensively reads a raw stored component bound action into the flat state
 * shape (also valid as set input — bound actions contain no array
 * primitives). Returns `undefined` for unrecognized shapes.
 */
export function componentBoundActionFromRaw(raw: unknown): ComponentBoundAction | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }
  switch (record.type) {
    case "none":
      return { type: "none" };
    case "close-paywall":
      return { type: "close-paywall" };
    case "set-variable": {
      const payload = asRecord(record.payload);
      if (!payload || typeof payload.variableId !== "string") {
        return undefined;
      }
      const newValue = componentActionValueSourceFromRaw(payload.newValue);
      if (newValue === undefined) {
        return undefined;
      }
      return { payload: { newValue, variableId: payload.variableId }, type: "set-variable" };
    }
    case "purchase-product": {
      const payload = asRecord(record.payload);
      if (!payload) {
        return undefined;
      }
      if (payload.type === "literal" && typeof payload.productId === "string") {
        return {
          payload: { productId: payload.productId, type: "literal" },
          type: "purchase-product",
        };
      }
      if (payload.type === "variable-reference" && typeof payload.variableId === "string") {
        return {
          payload: { type: "variable-reference", variableId: payload.variableId },
          type: "purchase-product",
        };
      }
      if (payload.type === "action-payload" && typeof payload.field === "string") {
        return {
          payload: { field: payload.field, type: "action-payload" },
          type: "purchase-product",
        };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

type ComponentActionValueSourceState = Extract<
  ComponentBoundAction,
  { type: "set-variable" }
>["payload"]["newValue"];

function componentActionValueSourceFromRaw(
  raw: unknown,
): ComponentActionValueSourceState | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }
  if (record.type === "literal") {
    const value = componentPropValueFromRaw(record.value);
    if (
      value === undefined ||
      value.key === "string-array" ||
      value.key === "number-array" ||
      value.key === "boolean-array"
    ) {
      return undefined;
    }
    return { type: "literal", value };
  }
  if (record.type === "variable-reference") {
    const value = asRecord(record.value);
    if (value && typeof value.id === "string") {
      return { type: "variable-reference", value: { id: value.id } };
    }
    return undefined;
  }
  if (record.type === "action-payload") {
    const value = asRecord(record.value);
    if (value && typeof value.field === "string") {
      return { type: "action-payload", value: { field: value.field } };
    }
    return undefined;
  }
  return undefined;
}

/** A named entry located in a component node's `props`/`actionBindings`. */
export interface NamedEntry {
  /** Array-entry id, usable with `at`/`remove` on the array proxy. */
  entryId: string;
  /** The raw stored value (`value`/`action` field), unvalidated. */
  raw: unknown;
}

function findNamedEntry(
  entries: unknown,
  name: string,
  valueField: "value" | "action",
): NamedEntry | undefined {
  if (!Array.isArray(entries)) {
    return undefined;
  }
  for (const entry of entries) {
    const record = asRecord(entry);
    if (!record || typeof record.id !== "string") {
      continue;
    }
    const value = asRecord(record.value);
    if (value && value.name === name) {
      return { entryId: record.id, raw: value[valueField] };
    }
  }
  return undefined;
}

/** Finds a component node's stored prop entry by prop name. */
export function findComponentPropEntry(props: unknown, propName: string): NamedEntry | undefined {
  return findNamedEntry(props, propName, "value");
}

/** Finds a component node's stored action binding entry by action name. */
export function findComponentActionEntry(
  actionBindings: unknown,
  actionName: string,
): NamedEntry | undefined {
  return findNamedEntry(actionBindings, actionName, "action");
}

/**
 * Literal prop value carried by a manifest prop definition's default, when
 * the definition has a default the editor can store. Mirrors the insertion
 * prefill mapping in `component-node-actions.ts`.
 */
export function manifestDefaultPropValue(
  def: ComponentPropDefinition,
): ComponentPropValuePlain | undefined {
  switch (def.kind) {
    case "string":
    case "select":
    case "image":
      return def.default === undefined ? undefined : { key: "string", value: def.default };
    case "number":
      return def.default === undefined ? undefined : { key: "number", value: def.default };
    case "boolean":
      return def.default === undefined ? undefined : { key: "boolean", value: def.default };
    case "ref":
    case "component":
      return undefined;
    case "array": {
      if (def.default === undefined) {
        return undefined;
      }
      switch (def.item.kind) {
        case "string":
        case "select":
        case "image":
          return {
            key: "string-array",
            value: def.default.filter((item): item is string => typeof item === "string"),
          };
        case "number":
          return {
            key: "number-array",
            value: def.default.filter((item): item is number => typeof item === "number"),
          };
        case "boolean":
          return {
            key: "boolean-array",
            value: def.default.filter((item): item is boolean => typeof item === "boolean"),
          };
        default:
          return undefined;
      }
    }
  }
}

/**
 * The variable type key a scalar manifest prop kind binds to, or `undefined`
 * for kinds the scalar `VariableInput` row cannot edit (arrays, component
 * kinds).
 */
export function scalarVariableTypeKeyForProp(
  def: ComponentPropDefinition,
): VariableTypeKey | undefined {
  switch (def.kind) {
    case "string":
    case "select":
    case "image":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "ref":
      return "product";
    default:
      return undefined;
  }
}
