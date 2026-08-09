import type { Command, Value } from "@voidhash/mimic-core";
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
}

export interface SubmitTransactionResponse {
  readonly accepted: boolean;
  readonly version: number;
  readonly transactionId: string;
  readonly reason?: string;
}

/**
 * Commands cross the wire as opaque JSON. Their shape is dynamic (nine command
 * kinds over user-defined paths) and the document engine validates every one as
 * it applies it, so decoding here stays lossless and accepts anything — the
 * declaration only carries the structured type across the boundary.
 */
const CommandFromWire = Schema.declare<Command>((_value): _value is Command => true);

export const TransactionEnvelopeSchema = Schema.Struct({
  id: Schema.String,
  baseVersion: Schema.Number,
  commands: Schema.Array(CommandFromWire),
  submittedAt: Schema.optional(Schema.String),
  actor: Schema.optional(
    Schema.Struct({
      userId: Schema.optional(Schema.String),
      connectionId: Schema.optional(Schema.String),
    }),
  ),
});

export const SubmitTransactionResponseSchema = Schema.Struct({
  accepted: Schema.Boolean,
  version: Schema.Number,
  transactionId: Schema.String,
  reason: Schema.optional(Schema.String),
});

export const decodeTransactionEnvelope = (input: unknown): TransactionEnvelope =>
  Schema.decodeUnknownSync(TransactionEnvelopeSchema)(input);

/**
 * Same rationale as {@link CommandFromWire} for document and presence values:
 * the RPC layer carries them as opaque JSON (`Schema.Unknown`) because their
 * shape follows a runtime-defined collection schema, and the host validates
 * them against that schema.
 */
const ValueFromWire = Schema.declare<Value>((_value): _value is Value => true);

/** Carries an opaque wire value into the structured `Value` type. */
export const decodeDocumentValue = Schema.decodeUnknownSync(ValueFromWire);
