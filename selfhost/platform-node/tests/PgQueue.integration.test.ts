import { QueueDriver } from "@voidhash/platform/Queue";
import { Deferred, Effect, Fiber, Layer, Option, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import type { PgPlatformConfig } from "../src/Postgres.ts";
import { PgQueueLive } from "../src/Queue.ts";

const config: PgPlatformConfig = {
  host: process.env.PLATFORM_NODE_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_NODE_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_NODE_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_NODE_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_NODE_PG_PASSWORD ?? "password"),
};

const messageSchema = Schema.Struct({ sequence: Schema.Number });
const queueLayer = () => Layer.merge(PgQueueLive(config), NodePlatformRuntimeLive);
const describePg = process.env.PLATFORM_NODE_PG_TEST === "1" ? describe : describe.skip;

describePg("Postgres queue driver", () => {
  it("persists FIFO messages across layer restarts", async () => {
    const queueName = `queue-persistence-${crypto.randomUUID()}`;

    await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        yield* queues.producer(queueName, messageSchema).publishBatch([
          { sequence: 1 },
          { sequence: 2 },
          { sequence: 3 },
        ]);
      }).pipe(Effect.provide(queueLayer())),
    );

    const messages: Array<number> = [];
    const processed = await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        return yield* queues.processBatch(
          queueName,
          messageSchema,
          (batch) =>
            Effect.sync(() => {
              messages.push(...batch.map(({ sequence }) => sequence));
            }),
          { batchSize: 10 },
        );
      }).pipe(Effect.provide(queueLayer())),
    );

    expect(processed).toBe(3);
    expect(messages).toEqual([1, 2, 3]);
  });

  it("retries failed deliveries before moving them to a dead-letter queue", async () => {
    const queueName = `queue-retry-${crypto.randomUUID()}`;
    const deadLetterQueue = `${queueName}-dlq`;
    const options = { maxRetries: 1, retryDelayMillis: 0, deadLetterQueue } as const;

    await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        yield* queues.producer(queueName, messageSchema).publish({ sequence: 7 });
        yield* queues.processBatch(
          queueName,
          messageSchema,
          () => Effect.fail("first failure"),
          options,
        );
        yield* queues.processBatch(
          queueName,
          messageSchema,
          () => Effect.fail("second failure"),
          options,
        );
      }).pipe(Effect.provide(queueLayer())),
    );

    const deadLetters: Array<number> = [];
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        const originalCount = yield* queues.processBatch(
          queueName,
          messageSchema,
          () => Effect.void,
          options,
        );
        const deadLetterCount = yield* queues.processBatch(
          deadLetterQueue,
          messageSchema,
          (batch) =>
            Effect.sync(() => {
              deadLetters.push(...batch.map(({ sequence }) => sequence));
            }),
        );
        return { originalCount, deadLetterCount };
      }).pipe(Effect.provide(queueLayer())),
    );

    expect(result).toEqual({ originalCount: 0, deadLetterCount: 1 });
    expect(deadLetters).toEqual([7]);
  });

  it("acks poison messages without invoking the handler", async () => {
    const queueName = `queue-poison-${crypto.randomUUID()}`;
    let handled = false;

    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        yield* queues.producer(queueName, Schema.Unknown).publish("not-a-message");
        const first = yield* queues.processBatch(queueName, messageSchema, () =>
          Effect.sync(() => {
            handled = true;
          }),
        );
        const second = yield* queues.processBatch(queueName, messageSchema, () => Effect.void);
        return [first, second] as const;
      }).pipe(Effect.provide(queueLayer())),
    );

    expect(counts).toEqual([1, 0]);
    expect(handled).toBe(false);
  });

  it("claims each message at most once across concurrent consumers", async () => {
    const queueName = `queue-concurrency-${crypto.randomUUID()}`;
    const messages = Array.from({ length: 40 }, (_, sequence) => ({ sequence }));
    const handled: Array<number> = [];

    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        yield* queues.producer(queueName, messageSchema).publishBatch(messages);
        return yield* Effect.all(
          [
            queues.processBatch(
              queueName,
              messageSchema,
              (batch) =>
                Effect.sync(() => {
                  handled.push(...batch.map(({ sequence }) => sequence));
                }),
              { batchSize: 40 },
            ),
            queues.processBatch(
              queueName,
              messageSchema,
              (batch) =>
                Effect.sync(() => {
                  handled.push(...batch.map(({ sequence }) => sequence));
                }),
              { batchSize: 40 },
            ),
          ],
          { concurrency: "unbounded" },
        );
      }).pipe(Effect.provide(queueLayer())),
    );

    expect(counts[0] + counts[1]).toBe(40);
    expect([...handled].sort((left, right) => left - right)).toEqual(
      messages.map(({ sequence }) => sequence),
    );
    expect(new Set(handled).size).toBe(40);
  });

  it("runs a polling consumer until its scope closes", async () => {
    const queueName = `queue-poll-${crypto.randomUUID()}`;
    const delivered = Deferred.makeUnsafe<ReadonlyArray<{ readonly sequence: number }>>();

    const received = await Effect.runPromise(
      Effect.gen(function* () {
        const queues = yield* QueueDriver;
        const consumer = yield* Effect.forkChild(
          queues.consumeBatch(
            queueName,
            messageSchema,
            (batch): Effect.Effect<void> =>
              Deferred.succeed(delivered, batch).pipe(Effect.asVoid),
            { pollIntervalMillis: 5 },
          ),
        );
        yield* Effect.yieldNow;
        yield* queues.producer(queueName, messageSchema).publish({ sequence: 42 });
        const result = yield* Deferred.await(delivered).pipe(Effect.timeoutOption("2 seconds"));
        const consumerExit = Option.fromNullishOr(consumer.pollUnsafe());
        yield* Fiber.interrupt(consumer);
        if (Option.isNone(result) && Option.isSome(consumerExit)) {
          throw new Error(`Polling consumer exited before delivery: ${String(consumerExit.value)}`);
        }
        return result;
      }).pipe(Effect.provide(queueLayer())),
    );

    expect(Option.getOrThrow(received)).toEqual([{ sequence: 42 }]);
  });
});
