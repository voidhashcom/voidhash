import type { Primitive } from "@voidhash/mimic-core";

import type { MaybeEntry } from "./types.ts";

/**
 * Unwraps a decoded CRDT ordered-array entry (`{ id, pos, value }`) to its inner
 * value. Tolerates already-plain values so the localization helpers work on both
 * decoded document snapshots and hand-built plain inputs.
 */
export function entryValue<T>(entry: MaybeEntry<T>): T {
  if (
    entry !== null &&
    typeof entry === "object" &&
    "id" in entry &&
    "pos" in entry &&
    "value" in entry
  ) {
    return (entry as Primitive.ArrayEntrySnapshot<T>).value;
  }
  return entry as T;
}
