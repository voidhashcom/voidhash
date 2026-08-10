import { DurableEntityHost, makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { QueueDriver } from "@voidhash/platform/Queue";
import * as Workflow from "@voidhash/platform/Workflow";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { numberOr } from "@voidhash/lib/lang";
import { Clock, DateTime, Effect, Layer, Schema } from "effect";
import { KeyValueStore, PersistedQueue } from "effect/unstable/persistence";
import { describe, expect, it } from "vitest";

import { ClusterDurableEntityHostLive } from "../src/ClusterDurableEntity.ts";
import { MemoryEntityAlarmStoreLive } from "../src/EntityAlarmStore.ts";
import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ClusterQueueLive } from "../src/Queue.ts";
import { TestClusterLive } from "../src/Topology.ts";
import * as ClusterWorkflowRunner from "../src/Workflow.ts";

const Message = Schema.Struct({ id: Schema.String });

const queueLayer = ClusterQueueLive.pipe(
  Layer.provide(PersistedQueue.layer),
  Layer.provide(PersistedQueue.layerStoreMemory),
  Layer.merge(NodePlatformRuntimeLive),
);

const workflowLayer = ClusterWorkflowRunner.layer.pipe(
  Layer.provide(TestClusterLive),
  Layer.merge(NodePlatformRuntimeLive),
);

const entityLayer = ClusterDurableEntityHostLive.pipe(
  Layer.provide(MemoryEntityAlarmStoreLive),
  Layer.provide(KeyValueStore.layerMemory),
  Layer.provide(TestClusterLive),
);

describe("cluster queue driver", () => {
  it("publishes a batch and delivers every message", () => {
    const seen: Array<string> = [];

    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const driver = yield* QueueDriver;
          yield* driver
            .producer("batch", Message)
            .publishBatch([{ id: "a" }, { id: "b" }, { id: "c" }]);

          // The driver delivers one message per claim, so drain until empty.
          yield* Effect.repeat(
            driver.processBatch(
              "batch",
              Message,
              (messages: ReadonlyArray<typeof Message.Type>) =>
                Effect.sync(() => void seen.push(...messages.map((m) => m.id))),
              { pollIntervalMillis: 50 },
            ),
            { until: (claimed: number) => claimed === 0 },
          );
        }).pipe(Effect.provide(queueLayer)),
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            expect([...seen].sort()).toEqual(["a", "b", "c"]);
          }),
        ),
      ),
    );
  });

  it("keeps separate queues isolated", () => {
    const seen: Array<string> = [];

    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const driver = yield* QueueDriver;
          yield* driver.producer("left", Message).publish({ id: "left-1" });

          const claimed = yield* driver.processBatch(
            "right",
            Message,
            (messages: ReadonlyArray<typeof Message.Type>) =>
              Effect.sync(() => void seen.push(...messages.map((m) => m.id))),
            { pollIntervalMillis: 50 },
          );
          expect(claimed).toBe(0);
        }).pipe(Effect.provide(queueLayer)),
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            expect(seen).toEqual([]);
          }),
        ),
      ),
    );
  });
});

describe("cluster workflow runner", () => {
  const Sleeper = Workflow.define({
    name: "cluster-sleeper",
    payload: { subject: Schema.String },
    success: Schema.String,
    idempotencyKey: (payload) => payload.subject,
  });

  it("resumes a workflow across a durable sleep", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(
            Sleeper,
            (payload, context) =>
              Effect.gen(function* () {
                // Already in the past, so the durable clock resolves immediately
                // instead of parking the execution.
                const now = yield* Clock.currentTimeMillis;
                yield* context.sleepUntil(
                  "wait",
                  DateTime.toDateUtc(DateTime.makeUnsafe(now - 1_000)),
                );
                return `woke ${payload.subject}`;
              }),
            Layer.empty,
          );
          return yield* runner.execute(Sleeper, { subject: "up" });
        }).pipe(Effect.provide(workflowLayer)),
      ).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            expect(result).toBe("woke up");
          }),
        ),
      ),
    ));

  it("memoizes a durable step so a retried body does not repeat it", () => {
    let sideEffects = 0;

    const Flaky = Workflow.define({
      name: "cluster-flaky",
      payload: { subject: Schema.String },
      success: Schema.String,
      idempotencyKey: (payload) => payload.subject,
    });

    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(
            Flaky,
            (payload, context) =>
              Effect.gen(function* () {
                const value = yield* context.step({
                  name: "count",
                  success: Schema.Number,
                  execute: Effect.sync(() => ++sideEffects),
                });
                return `${payload.subject}:${value}`;
              }),
            Layer.empty,
          );
          // Executing the same idempotency key twice joins one execution.
          yield* runner.execute(Flaky, { subject: "once" });
          return yield* runner.execute(Flaky, { subject: "once" });
        }).pipe(Effect.provide(workflowLayer)),
      ).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            expect(result).toBe("once:1");
            expect(sideEffects).toBe(1);
          }),
        ),
      ),
    );
  });
});

describe("cluster durable entity host", () => {
  it("serializes interleaved read-modify-write turns", () => {
    const address = makeDurableEntityAddress("counter", "shared");

    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;

          const increment = host.run(address, (entity) =>
            Effect.gen(function* () {
              const current = yield* entity.keyValue.get("count");
              const next = numberOr(current, 0) + 1;
              // Yield between read and write: without serialization the
              // increments would clobber each other.
              yield* Effect.sleep("1 millis");
              yield* entity.keyValue.put("count", next);
            }),
          );

          yield* Effect.all([increment, increment, increment, increment, increment], {
            concurrency: "unbounded",
          });
          return yield* host.run(address, (entity) => entity.keyValue.get("count"));
        }).pipe(Effect.provide(entityLayer)),
      ).pipe(
        Effect.tap((total) =>
          Effect.sync(() => {
            expect(total).toBe(5);
          }),
        ),
      ),
    );
  });
});
