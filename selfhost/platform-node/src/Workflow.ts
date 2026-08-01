import { EffectWorkflowRunnerLive } from "@voidhash/platform/EffectWorkflowRunner";
import type { WorkflowRunner } from "@voidhash/platform/Workflow";
import { Layer } from "effect";

import { PgWorkflowEngineLive } from "./PgWorkflowEngine.ts";
import type { PgPlatformConfig } from "./Postgres.ts";

/** Postgres-backed provider-neutral workflow runner. */
export const PgWorkflowRunnerLive = (config: PgPlatformConfig): Layer.Layer<WorkflowRunner> =>
  EffectWorkflowRunnerLive.pipe(Layer.provide(PgWorkflowEngineLive(config)));
