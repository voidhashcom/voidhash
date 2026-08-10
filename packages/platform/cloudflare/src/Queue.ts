import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Effect, Schema, SchemaParser } from "effect";

import { QueueProducerError, type QueueProducer } from "@voidhash/platform/Queue";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { requirePlatformRuntime } from "./PlatformRuntime.ts";

// Re-export the abstract surface so existing concrete consumers keep importing
// the producer contract from this module.
export { QueueProducerError, type QueueProducer };

/**
 * Build a typed producer for the given Cloudflare queue resource.
 *
 * Must be called from the Worker's init Effect (it depends on the queue binding
 * which is only available in a runtime context). The producer captures the
 * {@link Cloudflare.Queues.WriteQueueClient} once and reuses it for the lifetime of the
 * Worker. The send effects keep the provider-neutral `PlatformRuntime`
 * requirement so they can only run inside a configured runtime.
 *
 * @example
 * ```ts
 * const producer = yield* makeQueueProducer(CoreEventBus, EventBusEnvelope);
 * yield* producer.publish({ deliveryId, attemptNumber: 1, ... });
 * ```
 */
export const makeQueueProducer = <A, I>(
  queue: Cloudflare.Queues.Queue,
  schema: Schema.Codec<A, I>,
) =>
  Effect.gen(function* () {
    const sender = yield* Cloudflare.Queues.WriteQueue(queue);
    const runtimeContext = yield* RuntimeContext;
    const encode = SchemaParser.encodeUnknownEffect(schema);
    const queueName = queue.LogicalId;

    const sendOne = (message: A): Effect.Effect<void, QueueProducerError, PlatformRuntime> =>
      Effect.gen(function* () {
        const encoded = yield* encode(message).pipe(
          Effect.mapError(
            (cause) =>
              new QueueProducerError({
                cause: `encode failed: ${String(cause)}`,
                queueName,
              }),
          ),
        );
        yield* requirePlatformRuntime(sender.send(encoded), runtimeContext).pipe(
          Effect.mapError(
            (error) =>
              new QueueProducerError({
                cause: error.message,
                queueName,
              }),
          ),
        );
      });

    const sendMany = (
      messages: ReadonlyArray<A>,
    ): Effect.Effect<void, QueueProducerError, PlatformRuntime> =>
      Effect.gen(function* () {
        const encoded = yield* Effect.forEach(messages, (m) =>
          encode(m).pipe(
            Effect.mapError(
              (cause) =>
                new QueueProducerError({
                  cause: `encode failed: ${String(cause)}`,
                  queueName,
                }),
            ),
          ),
        );
        yield* requirePlatformRuntime(
          sender.sendBatch(encoded.map((body) => ({ body }))),
          runtimeContext,
        ).pipe(
          Effect.mapError(
            (error) =>
              new QueueProducerError({
                cause: error.message,
                queueName,
              }),
          ),
        );
      });

    return {
      publish: sendOne,
      publishBatch: sendMany,
    };
  });
