import { DurableEntityHost } from "@voidhash/platform/DurableEntity";
import * as MemoryWorkflowRunner from "@voidhash/platform/MemoryWorkflowRunner";
import {
  cronSchedulerConformance,
  durableEntityHostConformance,
  queueDriverConformance,
  workflowRunnerConformance,
} from "@voidhash/platform/conformance";
import { Effect, Layer } from "effect";
import { Sharding } from "effect/unstable/cluster";
import { KeyValueStore, PersistedQueue } from "effect/unstable/persistence";

import { ClusterCronSchedulerLive } from "../src/CronScheduler.ts";
import {
  ClusterDurableEntityControlLive,
  ClusterDurableEntityHostLive,
  makeClusterDurableEntityHost,
} from "../src/ClusterDurableEntity.ts";
import { DurableEntityAlarmStore, MemoryEntityAlarmStoreLive } from "../src/EntityAlarmStore.ts";
import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ClusterQueueLive } from "../src/Queue.ts";
import { TestClusterLive } from "../src/Topology.ts";
import * as ClusterWorkflowRunner from "../src/Workflow.ts";

/**
 * Each suite builds its own cluster so state cannot leak between tests. The
 * in-memory topology keeps the suite hermetic — no Postgres, no network.
 */
const queueLayer = () =>
  ClusterQueueLive.pipe(
    Layer.provide(PersistedQueue.layer),
    Layer.provide(PersistedQueue.layerStoreMemory),
    Layer.merge(NodePlatformRuntimeLive),
  );

const cronLayer = () =>
  ClusterCronSchedulerLive.pipe(
    Layer.provide(KeyValueStore.layerMemory),
    Layer.provide(TestClusterLive),
    Layer.merge(NodePlatformRuntimeLive),
  );

const entityLayer = () =>
  Layer.mergeAll(ClusterDurableEntityHostLive, ClusterDurableEntityControlLive).pipe(
    Layer.provide(MemoryEntityAlarmStoreLive),
    Layer.provide(KeyValueStore.layerMemory),
    Layer.provide(TestClusterLive),
  );

/**
 * A host whose runner owns no shard at all. The cluster host reads ownership
 * from `Sharding`, so overriding that one answer is enough to exercise the
 * locality gate without standing up a second runner.
 */
const unownedEntityLayer = () =>
  Layer.effect(
    DurableEntityHost,
    Effect.gen(function* () {
      const sharding = yield* Sharding.Sharding;
      const store = yield* KeyValueStore.KeyValueStore;
      const alarms = yield* DurableEntityAlarmStore;
      return makeClusterDurableEntityHost(
        { ...sharding, hasShardId: () => false },
        store,
        alarms,
        // Nothing will ever assign this shard, so there is no boot race to
        // wait out.
        { attachOwnershipTimeout: 0 },
      );
    }),
  ).pipe(
    Layer.provide(MemoryEntityAlarmStoreLive),
    Layer.provide(KeyValueStore.layerMemory),
    Layer.provide(TestClusterLive),
  );

const workflowLayer = () =>
  ClusterWorkflowRunner.layer.pipe(
    Layer.provide(TestClusterLive),
    Layer.merge(NodePlatformRuntimeLive),
  );

const memoryWorkflowLayer = () =>
  MemoryWorkflowRunner.layer.pipe(Layer.merge(NodePlatformRuntimeLive));

queueDriverConformance({ name: "cluster", layer: queueLayer });
cronSchedulerConformance({ name: "cluster", layer: cronLayer });
durableEntityHostConformance({
  name: "cluster",
  layer: entityLayer,
  supportsAlarmDispatch: entityLayer,
  requiresShardLocality: unownedEntityLayer,
});
workflowRunnerConformance({ name: "cluster", layer: workflowLayer });
workflowRunnerConformance({ name: "memory", layer: memoryWorkflowLayer });
