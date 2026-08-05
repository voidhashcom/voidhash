import * as EffectWorkflowRunner from "@voidhash/platform/EffectWorkflowRunner";
import type { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { Layer } from "effect";
import { ClusterWorkflowEngine, type MessageStorage, type Sharding } from "effect/unstable/cluster";

/**
 * Durable workflow runner backed by Effect Cluster.
 *
 * Each workflow execution becomes a cluster entity keyed by its execution ID,
 * so activities, durable clocks, and suspended runs persist in the cluster's
 * message storage rather than in a bespoke engine.
 */
export const layer: Layer.Layer<
  WorkflowRunner,
  never,
  Sharding.Sharding | MessageStorage.MessageStorage
> = EffectWorkflowRunner.layer.pipe(Layer.provide(ClusterWorkflowEngine.layer));
