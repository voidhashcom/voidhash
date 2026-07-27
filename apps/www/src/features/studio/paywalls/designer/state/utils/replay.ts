import type { Primitive } from "@voidhash/mimic-core";
import {
  actionSchema,
  dnfSchema,
  variableTypeSchema,
  type Action,
  type DNF,
  type VariableType,
} from "@voidhash/mimic-schema";

/** Write input for a state condition (plain arrays, unlike the snapshot). */
export type DnfInput = NonNullable<Primitive.InferInput<typeof dnfSchema>>;

function isEntryWrapped(value: unknown): value is { id: string; pos: string; value: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "pos" in value &&
    typeof value.pos === "string" &&
    "value" in value
  );
}

/**
 * Recursively converts decoded snapshot values into write-input shape:
 * snapshot arrays are `{id, pos, value}` entry-wrapped while inputs carry
 * plain elements. Plain values pass through untouched.
 */
export function unwrapEntriesDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      isEntryWrapped(item) ? unwrapEntriesDeep(item.value) : unwrapEntriesDeep(item),
    );
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = unwrapEntriesDeep(item);
    }
    return result;
  }
  return value;
}

/**
 * Replayability guard for raw payloads replayed through a primitive's write
 * input: validates the value against the primitive's schema (a runtime
 * encode round trip) and narrows it to the typed input. Unknown union
 * variants and malformed shapes return false — callers drop the payload
 * without throwing.
 */
export function replayableElementInput<TElement extends Primitive.AnyPrimitive>(
  element: TElement,
  raw: unknown,
): raw is NonNullable<Primitive.InferInput<TElement>> {
  try {
    return element.encodeOptional(raw) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Replayability guard for raw interaction/override action payloads flowing
 * through undo results: round-trips the value through the action schema and
 * returns the typed action, or `undefined` for payloads the schema rejects
 * (unknown union variants are dropped, never replayed — the engine rejects
 * them at set and validate).
 */
export function replayableAction(raw: unknown): Action | undefined {
  try {
    const encoded = actionSchema.encodeOptional(raw);
    return encoded === undefined ? undefined : actionSchema.decode(encoded);
  } catch {
    return undefined;
  }
}

/**
 * Replayability guard for raw variable values (`{key, value}`): returns the
 * typed value or `undefined` for payloads the schema rejects.
 */
export function replayableVariableValue(raw: unknown): VariableType | undefined {
  try {
    const encoded = variableTypeSchema.encodeOptional(raw);
    return encoded === undefined ? undefined : variableTypeSchema.decode(encoded);
  } catch {
    return undefined;
  }
}

/**
 * Converts a decoded condition snapshot back into write input by unwrapping
 * the `{id, pos, value}` array entries of its conjunction/predicate levels.
 */
export function dnfInputFromSnapshot(condition: DNF): DnfInput {
  return {
    type: "or",
    value: condition.value.flatMap((conjunctionEntry) =>
      conjunctionEntry.value === undefined
        ? []
        : [
            {
              type: "and" as const,
              value: conjunctionEntry.value.value.flatMap((predicateEntry) =>
                predicateEntry.value === undefined ? [] : [predicateEntry.value],
              ),
            },
          ],
    ),
  };
}

/**
 * Replayability guard for raw condition payloads in the PLAIN input shape
 * (UI-built conditions, undo payloads produced by {@link dnfInputFromSnapshot}).
 */
export function replayableDnfInput(raw: unknown): DnfInput | undefined {
  try {
    const encoded = dnfSchema.encodeOptional(raw);
    if (encoded === undefined) {
      return undefined;
    }
    const snapshot = dnfSchema.decode(encoded);
    return snapshot === undefined ? undefined : dnfInputFromSnapshot(snapshot);
  } catch {
    return undefined;
  }
}
