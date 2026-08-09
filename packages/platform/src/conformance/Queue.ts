import { Clock, Effect, Layer, Random, Schema } from "effect";
import { describe, expect, it } from "vitest";

import type { PlatformRuntime } from "../PlatformRuntime.ts";
import { QueueDriver } from "../Queue.ts";

const Message = Schema.Struct({ id: Schema.String });

/**
 * Durable stores keep undelivered rows between runs, so queue names are
 * per-run to stop one run's leftovers from leaking into the next.
 */
const runId = Effect.runSync(
  Effect.gen(function* () {
    const millis = yield* Clock.currentTimeMillis;
    const entropy = yield* Random.nextIntBetween(0, 0xff_ff_ff);
    return `${millis.toString(36)}-${entropy.toString(36)}`;
  }),
);
type Message = typeof Message.Type;

/** Wiring one adapter must supply for the queue conformance suite. */
export interface QueueConformanceOptions {
  /** Adapter name, used in test titles. */
  readonly name: string;
  /** Builds an isolated driver; called once per test so state never leaks. */
  readonly layer: () => Layer.Layer<QueueDriver | PlatformRuntime>;
  /**
   * Adapters that deliver whole batches can raise this; adapters that deliver
   * one message at a time leave it at 1.
   */
  readonly maxBatchSize?: number;
}

/** The outcome a retry-probing handler reports for one delivery. */
const handlerOutcome = (shouldFail: boolean): Effect.Effect<void, string> => {
  if (shouldFail) return Effect.fail("boom");
  return Effect.void;
};

/**
 * Behaviour every queue driver must exhibit, regardless of backend.
 *
 * The contract is at-least-once delivery with bounded retries: messages
 * survive a failing handler, poison payloads are acknowledged rather than
 * redelivered forever, and exhausted messages reach the dead-letter queue when
 * one is configured.
 */
export const queueDriverConformance = (options: QueueConformanceOptions): void => {
  const run = <A, E>(effect: Effect.Effect<A, E, QueueDriver | PlatformRuntime>): Promise<A> =>
    Effect.runPromise(Effect.scoped(effect.pipe(Effect.provide(options.layer()))));

  describe(`${options.name}: queue driver conformance`, () => {
    it("delivers a published message to a consumer", () =>
      run(
        Effect.gen(function* () {
          const seen: Array<string> = [];

          const driver = yield* QueueDriver;
          yield* driver.producer(`conformance-basic-${runId}`, Message).publish({ id: "first" });

          const claimed = yield* driver.processBatch(
            `conformance-basic-${runId}`,
            Message,
            (messages: ReadonlyArray<Message>) =>
              Effect.sync(() => void seen.push(...messages.map((message) => message.id))),
          );

          expect(claimed).toBeGreaterThan(0);
          expect(seen).toEqual(["first"]);
        }),
      ));

    it("reports an empty queue instead of blocking", () =>
      run(
        Effect.gen(function* () {
          const driver = yield* QueueDriver;
          const claimed = yield* driver.processBatch(
            `conformance-empty-${runId}`,
            Message,
            () => Effect.void,
            { pollIntervalMillis: 50 },
          );

          expect(claimed).toBe(0);
        }),
      ));

    it("redelivers a message after the handler fails", () =>
      run(
        Effect.gen(function* () {
          const attempts: Array<string> = [];

          const driver = yield* QueueDriver;
          yield* driver.producer(`conformance-retry-${runId}`, Message).publish({ id: "retry-me" });

          const consume = (shouldFail: boolean) =>
            driver.processBatch(
              `conformance-retry-${runId}`,
              Message,
              (messages: ReadonlyArray<Message>) =>
                Effect.sync(() => void attempts.push(...messages.map((m) => m.id))).pipe(
                  Effect.andThen(handlerOutcome(shouldFail)),
                ),
              { maxRetries: 2, pollIntervalMillis: 100, retryDelayMillis: 1 },
            );

          yield* consume(true);
          yield* consume(false);

          expect(attempts).toEqual(["retry-me", "retry-me"]);
        }),
      ));

    it("dead-letters a message once retries are exhausted", () =>
      run(
        Effect.gen(function* () {
          const dead: Array<string> = [];

          const driver = yield* QueueDriver;
          yield* driver.producer(`conformance-dlq-${runId}`, Message).publish({ id: "doomed" });

          // Zero retries: the first failure is terminal.
          yield* driver.processBatch(`conformance-dlq-${runId}`, Message, () => Effect.fail("boom"), {
            maxRetries: 0,
            deadLetterQueue: `conformance-dlq-dead-${runId}`,
            pollIntervalMillis: 100,
            retryDelayMillis: 1,
          });

          const claimed = yield* driver.processBatch(
            `conformance-dlq-dead-${runId}`,
            Message,
            (messages: ReadonlyArray<Message>) =>
              Effect.sync(() => void dead.push(...messages.map((m) => m.id))),
            { pollIntervalMillis: 200 },
          );

          expect(claimed).toBeGreaterThan(0);
          expect(dead).toEqual(["doomed"]);
        }),
      ));

    it("acknowledges an undecodable payload instead of redelivering it forever", () =>
      run(
        Effect.gen(function* () {
          const seen: Array<string> = [];

          const driver = yield* QueueDriver;
          // Publish through a schema the consumer cannot decode.
          yield* driver
            .producer(`conformance-poison-${runId}`, Schema.Struct({ unexpected: Schema.Number }))
            .publish({ unexpected: 1 });
          yield* driver.producer(`conformance-poison-${runId}`, Message).publish({ id: "good" });

          yield* driver.processBatch(
            `conformance-poison-${runId}`,
            Message,
            (messages: ReadonlyArray<Message>) =>
              Effect.sync(() => void seen.push(...messages.map((m) => m.id))),
            { pollIntervalMillis: 100 },
          );
          yield* driver.processBatch(
            `conformance-poison-${runId}`,
            Message,
            (messages: ReadonlyArray<Message>) =>
              Effect.sync(() => void seen.push(...messages.map((m) => m.id))),
            { pollIntervalMillis: 100 },
          );

          // The poison payload is dropped; the healthy message still arrives.
          expect(seen).toEqual(["good"]);
        }),
      ));
  });
};
