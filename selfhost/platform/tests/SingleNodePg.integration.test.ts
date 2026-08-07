import * as PgClient from "@effect/sql-pg/PgClient";
import { DurableEntityHost, makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { QueueDriver } from "@voidhash/platform/Queue";
import {
  durableEntityHostConformance,
  queueDriverConformance,
  workflowRunnerConformance,
} from "@voidhash/platform/conformance";
import { Clock, Config, Effect, Layer, Redacted, Schema } from "effect";
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
const SqlLive = Layer.unwrap(
  Effect.gen(function* () {
    return PgClient.layer({
      host: yield* Config.string("PLATFORM_SELFHOST_PG_HOST").pipe(
        Config.withDefault("127.0.0.1"),
      ),
      port: yield* Config.int("PLATFORM_SELFHOST_PG_PORT").pipe(Config.withDefault(5432)),
      database: yield* Config.string("PLATFORM_SELFHOST_PG_DATABASE").pipe(
        Config.withDefault("voidhash"),
      ),
      username: yield* Config.string("PLATFORM_SELFHOST_PG_USERNAME").pipe(
        Config.withDefault("voidhash"),
      ),
      password: yield* Config.redacted("PLATFORM_SELFHOST_PG_PASSWORD").pipe(
        Config.withDefault(Redacted.make("password")),
      ),
    });
  }).pipe(Effect.orDie),
);

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
  it("keeps entity state across independent host instances", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const startedAt = yield* Clock.currentTimeMillis;
        const address = makeDurableEntityAddress("durability", `run-${startedAt}`);

        yield* Effect.scoped(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.keyValue.put("value", { survives: true }));
          }).pipe(Effect.provide(entityLayer())),
        );

        // A brand-new host, and therefore a brand-new in-process lock and
        // session map, must still observe the persisted value.
        const restored = yield* Effect.scoped(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            return yield* host.run(address, (entity) => entity.keyValue.get("value"));
          }).pipe(Effect.provide(entityLayer())),
        );

        expect(restored).toEqual({ survives: true });
      }),
    ));

  it("keeps queued messages across independent driver instances", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const Message = Schema.Struct({ id: Schema.String });
        const startedAt = yield* Clock.currentTimeMillis;
        const queueName = `durability-${startedAt}`;
        const seen: Array<string> = [];

        yield* Effect.scoped(
          Effect.gen(function* () {
            const driver = yield* QueueDriver;
            yield* driver.producer(queueName, Message).publish({ id: "persisted" });
          }).pipe(Effect.provide(queueLayer())),
        );

        yield* Effect.scoped(
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
        );

        expect(seen).toEqual(["persisted"]);
      }),
    ));
});
