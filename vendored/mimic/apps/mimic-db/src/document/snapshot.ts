import type { Value } from "@voidhash/mimic-core";
import * as Schema from "effect/Schema";

export interface DocumentSnapshotResponse {
  readonly id: string;
  readonly collectionId: string;
  readonly value: Value;
  readonly version: number;
}

export const DocumentSnapshotResponseCodec = Schema.Struct({
  id: Schema.String,
  collectionId: Schema.String,
  value: Schema.Unknown,
  version: Schema.Number,
});
export type DocumentSnapshotResponseCodec = typeof DocumentSnapshotResponseCodec.Type;

export { DocumentSnapshotResponseCodec as DocumentSnapshotResponseSchema };
