import * as PgClient from "@effect/sql-pg/PgClient";
import { DurableEntityHost, makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { QueueDriver } from "@voidhash/platform/Queue";
import {
  durableEntityHostConformance,
  queueDriverConformance,
  workflowRunnerConformance,
} from "@voidhash/platform/conformance";
import { Effect, Layer, Redacted, Schema } from "effect";
import { KeyValueStore, PersistedQueue } from "effect/unstable/persistence";
import { describe, expect, it } from "vitest";

import {
  ClusterDurableEntityControlLive,
  ClusterDurableEntityHostLive,
} from "../src/ClusterDurableEntity.ts";
import { PgEntityAlarmStoreLive } from "../src/EntityAlarmStore.ts";
import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ClusterQueueLive } from "../src/Queue.ts";
import { SingleNodeClusterLive } from "../src/Topology.ts";
import * as ClusterWorkflowRunner from "../src/Workflow.ts";

/**
 * Exercises the production self-host topology: one runner whose mailboxes,
 * workflow state, queues, and entity state all live in Postgres.
 */
const SqlLive = PgClient.layer({
  host: process.env.PLATFORM_SELFHOST_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_SELFHOST_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_SELFHOST_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_SELFHOST_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_SELFHOST_PG_PASSWORD ?? "password"),
});

// Runner storage stays in memory: a single runner owns every shard, so the
// lease table would only add schema churn to the test database.
const ClusterLive = SingleNodeClusterLive({ runnerStorage: "memory" }).pipe(
  Layer.provide(SqlLive),
  Layer.orDie,
);

const workflowLayer = () =>
  ClusterWorkflowRunner.layer.pipe(
    Layer.provide(ClusterLive),
    Layer.merge(SelfhostPlatformRuntimeLive),
  );

const queueLayer = () =>
  ClusterQueueLive.pipe(
    Layer.provide(PersistedQueue.layer),
    Layer.provide(
      // The SQL store polls for new rows on an interval; it must be shorter
      // than the driver's claim window or `processBatch` reports an empty
      // queue that is not actually empty.
      PersistedQueue.layerStoreSql({ pollInterval: "50 millis" }).pipe(
        Layer.provide(SqlLive),
        Layer.orDie,
      ),
    ),
    Layer.merge(SelfhostPlatformRuntimeLive),
  );

const entityLayer = () =>
  Layer.mergeAll(ClusterDurableEntityHostLive, ClusterDurableEntityControlLive).pipe(
    Layer.provide(PgEntityAlarmStoreLive.pipe(Layer.provide(SqlLive), Layer.orDie)),
    Layer.provide(KeyValueStore.layerSql().pipe(Layer.provide(SqlLive), Layer.orDie)),
    Layer.provide(ClusterLive),
  );

workflowRunnerConformance({ name: "cluster/postgres", layer: workflowLayer });
queueDriverConformance({ name: "cluster/postgres", layer: queueLayer });
durableEntityHostConformance({
  name: "cluster/postgres",
  layer: entityLayer,
  supportsAlarmDispatch: entityLayer,
});

describe("cluster/postgres durability", () => {
  it("keeps entity state across independent host instances", async () => {
    const address = makeDurableEntityAddress("durability", `run-${Date.now()}`);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* host.run(address, (entity) => entity.keyValue.put("value", { survives: true }));
        }).pipe(Effect.provide(entityLayer())),
      ) as Effect.Effect<void>,
    );

    // A brand-new host, and therefore a brand-new in-process lock and
    // session map, must still observe the persisted value.
    const restored = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          return yield* host.run(address, (entity) => entity.keyValue.get("value"));
        }).pipe(Effect.provide(entityLayer())),
      ) as Effect.Effect<unknown>,
    );

    expect(restored).toEqual({ survives: true });
  });

  it("keeps queued messages across independent driver instances", async () => {
    const Message = Schema.Struct({ id: Schema.String });
    const queueName = `durability-${Date.now()}`;
    const seen: Array<string> = [];

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const driver = yield* QueueDriver;
          yield* driver.producer(queueName, Message).publish({ id: "persisted" });
        }).pipe(Effect.provide(queueLayer())),
      ) as Effect.Effect<void>,
    );

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const driver = yield* QueueDriver;
          yield* driver.processBatch(
            queueName,
            Message,
            (messages: ReadonlyArray<typeof Message.Type>) =>
              Effect.sync(() => void seen.push(...messages.map((m) => m.id))),
            { pollIntervalMillis: 500 },
          );
        }).pipe(Effect.provide(queueLayer())),
      ) as Effect.Effect<void>,
    );

    expect(seen).toEqual(["persisted"]);
  });
});
