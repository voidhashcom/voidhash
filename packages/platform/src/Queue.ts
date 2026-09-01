import type * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as EffectSchema from "effect/Schema";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import type { PrimitiveDefinition } from "./Primitive.ts";

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

/**
 * A typed queue definition and producer facade.
 *
 * Definitions are the single canonical declaration of a queue: every runtime
 * composition derives its physical resource name from `name`, so logical names
 * cannot drift between deployment targets.
 */
export interface QueueDefinition<Name extends string, A, I> extends PrimitiveDefinition<
  "queue",
  Name
> {
  readonly schema: Schema.Codec<A, I>;
  /** Publishes one message through the installed queue runtime. */
  readonly publish: (
    message: A,
  ) => Effect.Effect<void, QueueProducerError, QueueDriver | PlatformRuntime>;
  /** Publishes one atomic batch when supported by the installed runtime. */
  readonly publishBatch: (
    messages: ReadonlyArray<A>,
  ) => Effect.Effect<void, QueueProducerError, QueueDriver | PlatformRuntime>;
}

/** A queue consumer definition executed by the selected runtime. */
export interface QueueConsumerDefinition<Name extends string, A, I, R> extends PrimitiveDefinition<
  "queue-consumer",
  Name
> {
  readonly queue: QueueDefinition<string, A, I>;
  readonly options?: QueueConsumerOptions;
  readonly handler: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>;
}

/** Creates a typed queue definition without selecting a runtime backend. */
export const defineQueue = <const Name extends string, A, I>(
  name: Name,
  schema: Schema.Codec<A, I>,
): QueueDefinition<Name, A, I> => ({
  kind: "queue",
  name,
  schema,
  publish: (message) =>
    QueueDriver.pipe(Effect.flatMap((driver) => driver.producer(name, schema).publish(message))),
  publishBatch: (messages) =>
    QueueDriver.pipe(
      Effect.flatMap((driver) => driver.producer(name, schema).publishBatch(messages)),
    ),
});

/** Defines a typed queue consumer without selecting a runtime backend. */
export const defineQueueConsumer = <const Name extends string, A, I, R>(
  name: Name,
  options: {
    readonly queue: QueueDefinition<string, A, I>;
    readonly handler: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>;
    readonly options?: QueueConsumerOptions;
  },
): QueueConsumerDefinition<Name, A, I, R> => ({
  kind: "queue-consumer",
  name,
  queue: options.queue,
  handler: options.handler,
  options: options.options,
});
