import type { Command } from "@voidhash/mimic-core";
import { Schema } from "effect";

export interface TransactionActor {
  readonly userId?: string;
  readonly connectionId?: string;
}

export interface TransactionEnvelope {
  readonly id: string;
  readonly baseVersion: number;
  readonly commands: readonly Command[];
  readonly submittedAt?: string;
  readonly actor?: TransactionActor;
  /**
   * Optional. When present, the entity records the resulting snapshot at
   * this `schema_version`. Used by the migration runner so a per-document
   * migration transaction advances the document onto the new schema.
   */
  readonly schemaVersion?: number;
}

export interface SubmitTransactionResponse {
  readonly accepted: boolean;
  readonly version: number;
  readonly transactionId: string;
  readonly reason?: string;
}

export const TransactionEnvelopeSchema = Schema.Struct({
  id: Schema.String,
  baseVersion: Schema.Number,
  commands: Schema.Array(Schema.Unknown),
  submittedAt: Schema.optional(Schema.String),
  actor: Schema.optional(
    Schema.Struct({
      userId: Schema.optional(Schema.String),
      connectionId: Schema.optional(Schema.String),
    }),
  ),
  schemaVersion: Schema.optional(Schema.Number),
});

export const SubmitTransactionResponseSchema = Schema.Struct({
  accepted: Schema.Boolean,
  version: Schema.Number,
  transactionId: Schema.String,
  reason: Schema.optional(Schema.String),
});

export const decodeTransactionEnvelope = (input: unknown): TransactionEnvelope =>
  Schema.decodeUnknownSync(TransactionEnvelopeSchema)(input) as TransactionEnvelope;
