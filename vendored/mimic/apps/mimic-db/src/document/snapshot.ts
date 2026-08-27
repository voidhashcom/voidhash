import type { Value } from "@voidhash/mimic-core";
import { Schema } from "effect";

export interface DocumentSnapshotResponse {
  readonly id: string;
  readonly collectionId: string;
  readonly value: Value;
  readonly version: number;
}

export const DocumentSnapshotResponseSchema = Schema.Struct({
  id: Schema.String,
  collectionId: Schema.String,
  value: Schema.Unknown,
  version: Schema.Number,
});
