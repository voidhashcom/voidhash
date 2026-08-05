import * as PgClient from "@effect/sql-pg/PgClient";
import type { DbConfig } from "@voidhash/db/db";
import type { CronScheduler } from "@voidhash/platform/CronScheduler";
import type {
  DurableEntityAlarmControl,
  DurableEntityHost,
} from "@voidhash/platform/DurableEntity";
import type { KeyValueStore } from "@voidhash/platform/KeyValueStore";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import type { QueueDriver } from "@voidhash/platform/Queue";
import type { WorkflowRunner } from "@voidhash/platform/Workflow";
import {
  ClusterDurableEntityControlLive,
  ClusterDurableEntityHostLive,
} from "@voidhash/platform-selfhost/ClusterDurableEntity";
import { ClusterCronSchedulerLive } from "@voidhash/platform-selfhost/CronScheduler";
import { PgEntityAlarmStoreLive } from "@voidhash/platform-selfhost/EntityAlarmStore";
import { PgKeyValueStoreLive } from "@voidhash/platform-selfhost/KeyValueStore";
import { SelfhostPlatformRuntimeLive } from "@voidhash/platform-selfhost/PlatformRuntime";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { ClusterQueueLive } from "@voidhash/platform-selfhost/Queue";
import { SingleNodeClusterLive } from "@voidhash/platform-selfhost/Topology";
import { ClusterWorkflowRunnerLive } from "@voidhash/platform-selfhost/Workflow";
import { Layer, Redacted } from "effect";
import {
  KeyValueStore as PersistenceKeyValueStore,
  PersistedQueue,
} from "effect/unstable/persistence";

import type { SelfhostRuntimeConfig } from "../config.ts";

/**
 * The swappable platform primitives a self-host deployment installs.
 *
 * The mailer, the object store, and the screenshot renderer are deliberately
 * absent: they are plain clients configured per process rather than parts of
 * the shared cluster composition.
 */
export interface SelfhostPlatformLayers {
  readonly queue: Layer.Layer<QueueDriver>;
  readonly keyValueStore: Layer.Layer<KeyValueStore>;
  readonly cronScheduler: Layer.Layer<CronScheduler>;
  /**
   * The entity host and the control plane the alarm dispatcher polls. Entity
   * sessions are process-local, so this layer only serves entities whose shard
   * this runner owns — true by construction for the single-runner topology.
   */
  readonly durableEntities: Layer.Layer<DurableEntityHost | DurableEntityAlarmControl>;
  readonly workflowRunner: Layer.Layer<WorkflowRunner>;
  readonly runtime: Layer.Layer<PlatformRuntime>;
}

/**
 * The slice of runtime configuration a platform composition needs.
 *
 * Entrypoints that never read the full {@link SelfhostRuntimeConfig} — the
 * mimic process reads its own — still have to resolve their platform through
 * this module, so the input is declared narrowly.
 */
export type SelfhostPlatformSelection = Pick<SelfhostRuntimeConfig, "platformDatabase">;

/**
 * Converts an application-shaped connection into the platform's Postgres
 * parameters. Exported because the migration entrypoint builds the entity host
 * directly to create its tables.
 */
export const selfhostPlatformPostgres = (database: DbConfig): PgPlatformConfig => ({
  database: database.databaseName,
  host: database.host,
  password: Redacted.make(database.password),
  port: database.port,
  ...(database.ssl === undefined ? {} : { ssl: database.ssl }),
  username: database.username,
});

const platformLayers = (postgres: PgPlatformConfig): SelfhostPlatformLayers => {
  const sql = PgClient.layer({
    database: postgres.database,
    host: postgres.host,
    password: postgres.password,
    port: postgres.port,
    username: postgres.username,
    ...(postgres.ssl === undefined ? {} : { ssl: postgres.ssl }),
  }).pipe(Layer.orDie);

  // Every cluster-backed primitive shares this one topology value so a single
  // build installs a single runner. Two runners in one process would compete
  // for the same shard leases.
  const topology = SingleNodeClusterLive({ runnerStorage: "memory" }).pipe(
    Layer.provide(sql),
    Layer.orDie,
  );

  // The SQL store polls for new rows on an interval that has to stay shorter
  // than the driver's claim window, or a non-empty queue reads as empty.
  const persistedQueueStore = PersistedQueue.layerStoreSql({ pollInterval: "50 millis" }).pipe(
    Layer.provide(sql),
    Layer.orDie,
  );

  // Shared by the cron scheduler and entity values so both read one table.
  const persistenceKeyValueStore = PersistenceKeyValueStore.layerSql().pipe(
    Layer.provide(sql),
    Layer.orDie,
  );

  return {
    queue: ClusterQueueLive.pipe(
      Layer.provide(PersistedQueue.layer),
      Layer.provide(persistedQueueStore),
    ),
    // No cluster adapter implements the typed key-value contract's atomic
    // counters, so the analytics policy store stays on Postgres.
    keyValueStore: PgKeyValueStoreLive(postgres),
    cronScheduler: ClusterCronSchedulerLive.pipe(
      Layer.provide(persistenceKeyValueStore),
      Layer.provide(topology),
    ),
    durableEntities: Layer.mergeAll(
      ClusterDurableEntityHostLive,
      ClusterDurableEntityControlLive,
    ).pipe(
      Layer.provide(PgEntityAlarmStoreLive.pipe(Layer.provide(sql))),
      Layer.provide(persistenceKeyValueStore),
      Layer.provide(topology),
    ),
    workflowRunner: ClusterWorkflowRunnerLive.pipe(Layer.provide(topology)),
    runtime: SelfhostPlatformRuntimeLive,
  };
};

let cached: SelfhostPlatformLayers | undefined;

/**
 * Resolves the process-wide platform composition.
 *
 * The result is memoized for the lifetime of the process, and deliberately so:
 * every call site has to receive the *same* layer values, because Effect
 * memoizes a layer per build by reference. Handing out fresh values would give
 * one build two cluster topologies and two queue drivers, and a queue whose
 * producer and consumer are different driver instances never delivers.
 */
export const makeSelfhostPlatformLayers = (
  config: SelfhostPlatformSelection,
): SelfhostPlatformLayers => {
  cached ??= platformLayers(selfhostPlatformPostgres(config.platformDatabase));
  return cached;
};

/**
 * The process-wide platform layer: every swappable primitive except the
 * workflow runner, which {@link makeSelfhostWorkflowRuntimeLive} owns because
 * it also binds the workflow dispatch ports.
 */
export const makeSelfhostPlatformLive = (
  config: SelfhostRuntimeConfig,
): Layer.Layer<QueueDriver | KeyValueStore | CronScheduler | PlatformRuntime> => {
  const platform = makeSelfhostPlatformLayers(config);
  return Layer.mergeAll(
    platform.queue,
    platform.keyValueStore,
    platform.cronScheduler,
    platform.runtime,
  );
};
