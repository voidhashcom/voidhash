import type { Primitive } from "@voidhash/mimic-core";

import type { MaybeEntry } from "./types.ts";

/** Narrows a possibly-wrapped array element to its CRDT ordered-entry envelope. */
function isArrayEntry<T>(entry: MaybeEntry<T>): entry is Primitive.ArrayEntrySnapshot<T> {
  return (
    entry !== null &&
    typeof entry === "object" &&
    "id" in entry &&
    "pos" in entry &&
    "value" in entry
  );
}

/**
 * Unwraps a decoded CRDT ordered-array entry (`{ id, pos, value }`) to its inner
 * value. Tolerates already-plain values so the localization helpers work on both
 * decoded document snapshots and hand-built plain inputs.
 */
export function entryValue<T>(entry: MaybeEntry<T>): T {
  if (isArrayEntry(entry)) {
    return entry.value;
  }
  return entry;
}
