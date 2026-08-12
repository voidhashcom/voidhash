import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Layer, Schema, SchemaParser, Stream } from "effect";

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
 * Observability wiring for a queue consumer, layered on top of the Cloudflare
 * subscriber settings.
 */
export interface QueueConsumerTelemetryOptions {
  /**
   * Exporter layer provided around EACH batch invocation.
   *
   * It must be per-invocation, not per-Worker: an OTLP exporter flushes when
   * its scope closes, and a Cloudflare Worker freezes between invocations with
   * no reliable background timer — a Worker-lifetime exporter would never ship
   * the last batch's spans or logs. Defaults to `Layer.empty`, which leaves
   * every consumer on Effect's free no-op tracer.
   */
  readonly telemetry?: Layer.Layer<never>;
}

/**
 * Subscriber settings passed through to the underlying Cloudflare
 * `consumeQueueMessages(...)` call ({@link Cloudflare.Queues.MessagesProps}, so
 * callers don't reach into `alchemy/Cloudflare` directly), plus the optional
 * {@link QueueConsumerTelemetryOptions} consumed by this module itself.
 */
export type QueueConsumerOptions = Cloudflare.Queues.MessagesProps &
  QueueConsumerTelemetryOptions;

/**
 * Wraps one batch invocation in its `queue.consume <LogicalQueueName>` root
 * span and the per-invocation exporter scope. `batchSize` is read on exit (via
 * `Effect.ensuring`) so the attribute is recorded on failed batches too.
 */
const withBatchTelemetry = <A, E, R>(
  queueName: string,
  telemetry: Layer.Layer<never> | undefined,
  batchSize: () => number,
  batch: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  batch.pipe(
    Effect.ensuring(
      Effect.suspend(() => Effect.annotateCurrentSpan("voidhash.queue.batch_size", batchSize())),
    ),
    Effect.withSpan(`queue.consume ${queueName}`, {
      attributes: { "voidhash.queue.name": queueName },
      kind: "consumer",
    }),
    Effect.provide(telemetry ?? Layer.empty),
  );

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
  const { telemetry, ...subscription } = options;
  const decode = SchemaParser.decodeUnknownEffect(schema);
  return Cloudflare.Queues.consumeQueueMessages<I>(queue, subscription, (stream) => {
    let received = 0;
    return withBatchTelemetry(
      queueName,
      telemetry,
      () => received,
      Stream.runForEach(stream, (raw) => {
        received += 1;
        return decode(raw.body).pipe(
          Effect.matchCauseEffect({
            onFailure: (cause) =>
              Effect.logWarning("queue payload decode failed; acking poison message", {
                queueName,
                messageId: raw.id,
                cause: String(cause),
              }).pipe(Effect.tap(() => Effect.sync(() => raw.ack()))),
            onSuccess: (message) => handle(message),
          }),
        );
      }),
    );
  });
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
  const { telemetry, ...subscription } = options;
  const decode = SchemaParser.decodeUnknownEffect(schema);
  return Cloudflare.Queues.consumeQueueMessages<I>(queue, subscription, (stream) => {
    let received = 0;
    return withBatchTelemetry(
      queueName,
      telemetry,
      () => received,
      Effect.gen(function* () {
        const decoded: Array<A> = [];
        yield* Stream.runForEach(stream, (raw) => {
          received += 1;
          return decode(raw.body).pipe(
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
          );
        });
        if (decoded.length > 0) {
          yield* handleBatch(decoded);
        }
      }),
    );
  });
};
