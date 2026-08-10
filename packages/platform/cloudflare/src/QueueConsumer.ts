import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Schema, SchemaParser, Stream } from "effect";

/**
 * Catch-all queue-consumer error. Wraps Schema decode failures and handler
 * errors at the consumer boundary. Decode failures are logged and acked
 * (poison-pill protection); handler failures cause the batch to retry per
 * the queue's `maxRetries` / `retryDelay` settings.
 */
export class QueueConsumerError extends Schema.TaggedErrorClass<QueueConsumerError>(
  "QueueConsumerError",
)("QueueConsumerError", {
  cause: Schema.String,
  queueName: Schema.String,
}) {}

/**
 * Subscriber settings passed through to the underlying Cloudflare
 * `consumeQueueMessages(...)` call. Mirrors {@link Cloudflare.Queues.MessagesProps}
 * with no additions — kept as a re-export so callers don't reach into
 * `alchemy/Cloudflare` directly.
 */
export type QueueConsumerOptions = Cloudflare.Queues.MessagesProps;

/**
 * Subscribe to a Cloudflare Queue with a Schema-typed handler.
 *
 * Each batch is streamed through `handle`; messages that fail Schema decode
 * are logged and acked individually so a single bad message never poisons
 * the batch. Handler failures bubble up to the outer subscribe, which calls
 * `msg.retry()` on every message in the batch — Cloudflare then applies the
 * configured `maxRetries` / `retryDelay` and dead-letters on exhaustion.
 *
 * Must be called from the Worker's init Effect.
 *
 * @example
 * ```ts
 * yield* consumeQueue(CoreEventBus, EventBusEnvelope, (msg) =>
 *   eventBus.dispatch(msg),
 *   { batchSize: 10, maxRetries: 3, deadLetterQueue: CoreEventBusDlq.queueName as unknown as string },
 * );
 * ```
 */
export const consumeQueue = <A, I, R>(
  queue: Cloudflare.Queues.Queue,
  schema: Schema.Codec<A, I>,
  handle: (message: A) => Effect.Effect<void, unknown, R>,
  options: QueueConsumerOptions = {},
) => {
  const queueName = queue.LogicalId;
  const decode = SchemaParser.decodeUnknownEffect(schema);
  return Cloudflare.Queues.consumeQueueMessages<I>(queue, options, (stream) =>
    Stream.runForEach(stream, (raw) =>
      decode(raw.body).pipe(
        Effect.matchCauseEffect({
          onFailure: (cause) =>
            Effect.logWarning("queue payload decode failed; acking poison message", {
              queueName,
              messageId: raw.id,
              cause: String(cause),
            }).pipe(Effect.tap(() => Effect.sync(() => raw.ack()))),
          onSuccess: (message) => handle(message),
        }),
      ),
    ),
  );
};

/**
 * Batch variant of {@link consumeQueue}: the whole delivered batch is decoded,
 * poison (decode-failure) messages are acked individually, and the surviving
 * messages are handed to `handleBatch` in a SINGLE call. Use this when the
 * downstream work is cheaper amortized over a batch — e.g. one ClickHouse
 * insert and one dedup query per delivery instead of one per message.
 *
 * Retry semantics match {@link consumeQueue}: if `handleBatch` fails, every
 * non-poison message in the batch is retried per the queue's `maxRetries`, then
 * dead-lettered on exhaustion — so the batch handler MUST be idempotent.
 *
 * Must be called from the Worker's init Effect.
 */
export const consumeQueueBatch = <A, I, R>(
  queue: Cloudflare.Queues.Queue,
  schema: Schema.Codec<A, I>,
  handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
  options: QueueConsumerOptions = {},
) => {
  const queueName = queue.LogicalId;
  const decode = SchemaParser.decodeUnknownEffect(schema);
  return Cloudflare.Queues.consumeQueueMessages<I>(queue, options, (stream) =>
    Effect.gen(function* () {
      const decoded: Array<A> = [];
      yield* Stream.runForEach(stream, (raw) =>
        decode(raw.body).pipe(
          Effect.matchCauseEffect({
            onFailure: (cause) =>
              Effect.logWarning("queue payload decode failed; acking poison message", {
                queueName,
                messageId: raw.id,
                cause: String(cause),
              }).pipe(Effect.tap(() => Effect.sync(() => raw.ack()))),
            onSuccess: (message) =>
              Effect.sync(() => {
                decoded.push(message);
              }),
          }),
        ),
      );
      if (decoded.length > 0) {
        yield* handleBatch(decoded);
      }
    }),
  );
};
