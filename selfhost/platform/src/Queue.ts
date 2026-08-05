import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import {
  QueueConsumerError,
  type QueueConsumerOptions,
  QueueDriver,
  type QueueDriverShape,
  QueueProducerError,
  type QueueProducer,
} from "@voidhash/platform/Queue";
import { Cause, Duration, Effect, Layer, Schema, SchemaParser } from "effect";
import { PersistedQueue } from "effect/unstable/persistence";

/**
 * Messages are persisted as JSON text rather than as the caller's schema.
 *
 * Decoding inside the queue would surface a malformed payload as a take
 * failure, which the store would then retry forever. Owning the decode step
 * lets a poison message be acknowledged and logged, matching the contract's
 * at-least-once-with-bounded-retries guarantee.
 */
const transportSchema = Schema.String;

type TransportQueue = PersistedQueue.PersistedQueue<string, never>;

const defaultOptions = {
  batchSize: 10,
  maxRetries: 3,
  retryDelayMillis: 1_000,
  pollIntervalMillis: 250,
} as const;

const positiveInteger = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value <= 0 ? fallback : Math.floor(value);

const nonNegativeInteger = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value < 0 ? fallback : Math.floor(value);

const resolvedOptions = (options: QueueConsumerOptions | undefined) => ({
  batchSize: positiveInteger(options?.batchSize, defaultOptions.batchSize),
  maxRetries: nonNegativeInteger(options?.maxRetries, defaultOptions.maxRetries),
  retryDelayMillis: nonNegativeInteger(options?.retryDelayMillis, defaultOptions.retryDelayMillis),
  pollIntervalMillis: positiveInteger(options?.pollIntervalMillis, defaultOptions.pollIntervalMillis),
  deadLetterQueue: options?.deadLetterQueue,
});

const producerError = (queueName: string, cause: unknown) =>
  new QueueProducerError({ queueName, cause: String(cause) });

const consumerError = (queueName: string, cause: unknown) =>
  new QueueConsumerError({ queueName, cause: String(cause) });

/**
 * Signals that a handler failed and the message should go back to the store.
 *
 * The store decides ack-versus-retry from the take effect's outcome, so a
 * retry has to surface as a failure. Tagging it keeps the driver from
 * mistaking a genuine store or SQL failure for an ordinary retry.
 */
class HandlerRetry {
  readonly _tag = "HandlerRetry";
}

const encodeJson = (value: unknown): Effect.Effect<string, unknown> =>
  Effect.try({
    try: () => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) throw new TypeError("Queue messages must be JSON-serializable");
      return encoded;
    },
    catch: (cause) => cause,
  });

const makeQueueDriver = (
  factory: PersistedQueue.PersistedQueueFactory["Service"],
): QueueDriverShape => {
  const queues = new Map<string, TransportQueue>();

  /**
   * Returns the one persisted queue instance for a logical name.
   *
   * Producers and consumers must share an instance: a backing store can attach
   * per-instance state such as poll registrations, so handing out a fresh
   * instance per call leaves published messages undelivered.
   */
  const queueFor = (queueName: string): Effect.Effect<TransportQueue> =>
    Effect.suspend(() => {
      const existing = queues.get(queueName);
      if (existing) return Effect.succeed(existing);
      return factory.make({ name: queueName, schema: transportSchema }).pipe(
        Effect.tap((queue) => Effect.sync(() => void queues.set(queueName, queue as TransportQueue))),
        Effect.orDie,
      ) as unknown as Effect.Effect<TransportQueue>;
    });

  const producer = <A, I>(
    queueName: string,
    schema: Schema.Codec<A, I>,
  ): QueueProducer<A> => {
    const encode = SchemaParser.encodeUnknownEffect(schema);

    const publishOne = (message: A) =>
      Effect.gen(function* () {
        const queue = yield* queueFor(queueName);
        const encoded = yield* encode(message);
        const body = yield* encodeJson(encoded);
        yield* queue.offer(body);
      });

    return {
      publish: (message) =>
        PlatformRuntime.pipe(
          Effect.andThen(publishOne(message)),
          Effect.mapError((cause) => producerError(queueName, cause)),
        ),
      // The persisted store has no multi-offer primitive, so a batch is a
      // sequence of offers. Publishing is idempotent per message, not atomic
      // across the batch.
      publishBatch: (messages) =>
        PlatformRuntime.pipe(
          Effect.andThen(Effect.forEach(messages, publishOne, { discard: true })),
          Effect.mapError((cause) => producerError(queueName, cause)),
        ),
    };
  };

  /**
   * Handles at most one message.
   *
   * The store decides ack-versus-retry from this effect's outcome: succeeding
   * acknowledges, failing returns the message for another attempt. Poison
   * payloads and exhausted retries therefore succeed on purpose, after being
   * logged or routed to the dead-letter queue.
   */
  const handleOne = <A, I, R>(
    queueName: string,
    schema: Schema.Codec<A, I>,
    handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
    options: ReturnType<typeof resolvedOptions>,
    claim: { claimed: boolean },
  ) =>
    Effect.gen(function* () {
      const queue = yield* queueFor(queueName);
      const decode = SchemaParser.decodeUnknownEffect(schema);

      return yield* queue.take(
        (body, metadata) =>
          Effect.gen(function* () {
            claim.claimed = true;
            const parsed = yield* Effect.try({
              try: () => JSON.parse(body) as unknown,
              catch: (cause) => cause,
            }).pipe(
              Effect.matchEffect({
                onFailure: () => Effect.succeedNone,
                onSuccess: (value: unknown) => Effect.succeedSome(value),
              }),
            );

            if (parsed._tag === "None") {
              yield* Effect.logWarning("queue payload is not valid JSON; acking poison message", {
                queueName,
                messageId: metadata.id,
              });
              return;
            }

            const decoded = yield* decode(parsed.value).pipe(
              Effect.matchCauseEffect({
                onFailure: (cause) =>
                  Effect.logWarning("queue payload decode failed; acking poison message", {
                    queueName,
                    messageId: metadata.id,
                    cause: Cause.pretty(cause),
                  }).pipe(Effect.as(undefined)),
                onSuccess: (message) => Effect.succeed(message),
              }),
            );
            if (decoded === undefined) return;

            yield* handleBatch([decoded]).pipe(
              Effect.catchCause((cause) =>
                Effect.gen(function* () {
                  // `attempts` counts prior failed deliveries, so it is 0 the
                  // first time a message is handled: a queue configured with
                  // zero retries dead-letters immediately.
                  if (metadata.attempts < options.maxRetries) {
                    // Hand the message back to the store for another attempt.
                    yield* Effect.logDebug("queue handler failed; returning message", {
                      queueName,
                      messageId: metadata.id,
                      cause: Cause.pretty(cause),
                    });
                    return yield* Effect.fail(new HandlerRetry());
                  }
                  yield* Effect.logWarning("queue message exhausted retries", {
                    queueName,
                    messageId: metadata.id,
                    attempts: metadata.attempts,
                    cause: Cause.pretty(cause),
                  });
                  if (options.deadLetterQueue) {
                    const dlq = yield* queueFor(options.deadLetterQueue);
                    yield* dlq.offer(body);
                  }
                }),
              ),
            );
          }),
        // Retry accounting is this driver's job, not the store's, so the store
        // is told never to give up. The bound stays inside a 32-bit integer
        // because SQL stores compare it against an INT column.
        { maxAttempts: 2_000_000_000 },
      );
    });

  const processBatch = <A, I, R>(
    queueName: string,
    schema: Schema.Codec<A, I>,
    handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
    inputOptions: QueueConsumerOptions | undefined,
  ) => {
    const options = resolvedOptions(inputOptions);
    return PlatformRuntime.pipe(
      Effect.andThen(Effect.sync(() => ({ claimed: false }))),
      Effect.flatMap((claim) =>
        // `take` waits for a message, but `processBatch` must report an empty
        // queue instead of blocking, so the wait is bounded by the poll
        // interval. Interrupting the wait releases no lock, since nothing was
        // claimed yet.
        Effect.scoped(handleOne(queueName, schema, handleBatch, options, claim)).pipe(
          Effect.timeoutOption(Duration.millis(options.pollIntervalMillis)),
          // A failing handler is ordinary queue behaviour, not a driver
          // failure: the store has already recorded the attempt by the time the
          // scope closes, so the claim is reported rather than raised. Catching
          // outside the scope is what lets the store see the failure at all.
          // Store and SQL failures are deliberately left to propagate.
          Effect.catchIf(
            (error): error is HandlerRetry =>
              typeof error === "object" && error !== null && "_tag" in error &&
              (error as { _tag?: unknown })._tag === "HandlerRetry",
            () => Effect.void,
          ),
          Effect.map(() => (claim.claimed ? 1 : 0)),
        ),
      ),
      Effect.mapError((cause) => consumerError(queueName, cause)),
    );
  };

  return {
    producer,
    processBatch,
    consumeBatch: (queueName, schema, handleBatch, options) => {
      const resolved = resolvedOptions(options);
      return Effect.forever(
        Effect.suspend(() =>
          Effect.scoped(
            handleOne(queueName, schema, handleBatch, resolved, { claimed: false }),
          ).pipe(
            Effect.catchCause((cause) =>
              Effect.logDebug("queue message returned for retry", {
                queueName,
                cause: Cause.pretty(cause),
              }).pipe(Effect.andThen(Effect.sleep(Duration.millis(resolved.retryDelayMillis)))),
            ),
          ),
        ),
      );
    },
  } as QueueDriverShape;
};

/**
 * Queue driver backed by Effect's persisted queue.
 *
 * Messages are delivered one at a time, so a consumer's batch always holds a
 * single message; retries and dead-lettering are therefore per message rather
 * than per batch.
 *
 * Note for SQL-backed stores: `processBatch` gives up after
 * `pollIntervalMillis`, so that window must exceed the store's own poll
 * interval, or a non-empty queue can look empty. The SQL store defaults to one
 * second, which is longer than this driver's default claim window.
 */
export const ClusterQueueLive: Layer.Layer<
  QueueDriver,
  never,
  PersistedQueue.PersistedQueueFactory
> = Layer.effect(
  QueueDriver,
  Effect.map(PersistedQueue.PersistedQueueFactory, makeQueueDriver),
);
