import type { Effect, Schema } from "effect";
import { Context, Schema as EffectSchema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised when a typed queue message cannot be published. */
export class QueueProducerError extends EffectSchema.TaggedErrorClass<QueueProducerError>(
  "QueueProducerError",
)("QueueProducerError", {
  cause: EffectSchema.String,
  queueName: EffectSchema.String,
}) {}

/** Provider-neutral typed queue publisher. */
export interface QueueProducer<A> {
  /** Publishes one schema-encoded message. */
  readonly publish: (message: A) => Effect.Effect<void, QueueProducerError, PlatformRuntime>;
  /** Atomically publishes a schema-encoded message batch when the adapter supports it. */
  readonly publishBatch: (
    messages: ReadonlyArray<A>,
  ) => Effect.Effect<void, QueueProducerError, PlatformRuntime>;
}

/** Stable failure raised by a queue consumer driver. */
export class QueueConsumerError extends EffectSchema.TaggedErrorClass<QueueConsumerError>(
  "QueueConsumerError",
)("QueueConsumerError", {
  cause: EffectSchema.String,
  queueName: EffectSchema.String,
}) {}

/** Provider-neutral delivery and retry policy for a queue consumer. */
export interface QueueConsumerOptions {
  readonly batchSize?: number;
  readonly maxRetries?: number;
  readonly retryDelayMillis?: number;
  readonly visibilityTimeoutMillis?: number;
  readonly pollIntervalMillis?: number;
  readonly deadLetterQueue?: string;
}

/** Runtime queue capabilities shared by cloud and single-node adapters. */
export interface QueueDriverShape {
  /** Creates a typed producer for a logical queue. */
  readonly producer: <A, I>(queueName: string, schema: Schema.Codec<A, I>) => QueueProducer<A>;
  /** Claims and handles at most one available batch, returning its claimed row count. */
  readonly processBatch: <A, I, R>(
    queueName: string,
    schema: Schema.Codec<A, I>,
    handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
    options?: QueueConsumerOptions,
  ) => Effect.Effect<number, QueueConsumerError, PlatformRuntime | R>;
  /** Polls and handles batches until the enclosing Effect scope is interrupted. */
  readonly consumeBatch: <A, I, R>(
    queueName: string,
    schema: Schema.Codec<A, I>,
    handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
    options?: QueueConsumerOptions,
  ) => Effect.Effect<never, QueueConsumerError, PlatformRuntime | R>;
}

/** Provider-neutral queue runtime used by application composition roots. */
export class QueueDriver extends Context.Service<QueueDriver, QueueDriverShape>()(
  "@voidhash/platform/QueueDriver",
) {}
