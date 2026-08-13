import { NodeCrypto } from "@effect/platform-node";
import { type Config, Layer } from "effect";
import type { SqlClient } from "effect/unstable/sql";
import {
  MessageStorage,
  type Runners,
  type Sharding,
  type ShardingConfig,
  SingleRunner,
  TestRunner,
} from "effect/unstable/cluster";

/**
 * Cluster services every cluster-backed adapter needs in context.
 *
 * A topology decides how those services are backed: one process with durable
 * SQL mailboxes, many processes over a network transport, or an ephemeral
 * in-memory cluster for tests. Adapters never name a topology themselves, so a
 * deployment can move between them without touching adapter code.
 */
export type ClusterTopology = Sharding.Sharding | Runners.Runners | MessageStorage.MessageStorage;

/**
 * Single-process cluster over the ambient SQL client.
 *
 * This is the default single-process Node topology: one runner owns every shard, while
 * mailboxes, workflow state, and cron slots persist in SQL so nothing is lost
 * across restarts.
 */
export const SingleNodeClusterLive = (options?: {
  readonly shardingConfig?: Partial<ShardingConfig.ShardingConfig["Service"]>;
  readonly runnerStorage?: "memory" | "sql";
}): Layer.Layer<ClusterTopology, Config.ConfigError, SqlClient.SqlClient> =>
  SingleRunner.layer({
    shardingConfig: options?.shardingConfig,
    runnerStorage: options?.runnerStorage ?? "sql",
  }).pipe(Layer.provide(NodeCrypto.layer));

/**
 * Fully in-memory cluster with no SQL dependency, for tests and ephemeral
 * local development. State does not survive the process.
 */
export const TestClusterLive: Layer.Layer<ClusterTopology | MessageStorage.MemoryDriver> =
  TestRunner.layer;
