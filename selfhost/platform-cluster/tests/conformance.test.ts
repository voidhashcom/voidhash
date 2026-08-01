import {
  cronSchedulerConformance,
  durableEntityHostConformance,
  queueDriverConformance,
  workflowRunnerConformance,
} from "@voidhash/platform/conformance";
import { Layer } from "effect";
import { KeyValueStore, PersistedQueue } from "effect/unstable/persistence";

import { ClusterCronSchedulerLive } from "../src/CronScheduler.ts";
import { ClusterDurableEntityHostLive } from "../src/DurableEntity.ts";
import { ClusterPlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ClusterQueueLive } from "../src/Queue.ts";
import { TestClusterLive } from "../src/Topology.ts";
import { ClusterWorkflowRunnerLive } from "../src/Workflow.ts";

/**
 * Each suite builds its own cluster so state cannot leak between tests. The
 * in-memory topology keeps the suite hermetic — no Postgres, no network.
 */
const queueLayer = () =>
  ClusterQueueLive.pipe(
    Layer.provide(PersistedQueue.layer),
    Layer.provide(PersistedQueue.layerStoreMemory),
    Layer.merge(ClusterPlatformRuntimeLive),
  );

const cronLayer = () =>
  ClusterCronSchedulerLive.pipe(
    Layer.provide(KeyValueStore.layerMemory),
    Layer.provide(TestClusterLive),
    Layer.merge(ClusterPlatformRuntimeLive),
  );

const entityLayer = () =>
  ClusterDurableEntityHostLive.pipe(
    Layer.provide(KeyValueStore.layerMemory),
    Layer.provide(TestClusterLive),
  );

const workflowLayer = () =>
  ClusterWorkflowRunnerLive.pipe(
    Layer.provide(TestClusterLive),
    Layer.merge(ClusterPlatformRuntimeLive),
  );

queueDriverConformance({ name: "cluster", layer: queueLayer });
cronSchedulerConformance({ name: "cluster", layer: cronLayer });
durableEntityHostConformance({ name: "cluster", layer: entityLayer });
workflowRunnerConformance({ name: "cluster", layer: workflowLayer });
