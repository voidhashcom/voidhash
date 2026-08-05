import type { Scope, Schema } from "effect";
import { Effect, Layer } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import * as Workflow from "./Workflow.ts";
import { WorkflowRunner, type WorkflowRunnerError } from "./WorkflowRunner.ts";

/** Cron trigger attached to a workflow registration. */
export interface Cron<Payload> {
  readonly schedule: string;
  readonly payload: (scheduledTime: Date) => Payload;
}

/** A shared workflow body, dependency blueprint, and optional trigger. */
export interface WorkflowRegistration<RIn> {
  readonly workflow: Workflow.Any;
  readonly cron?: {
    readonly schedule: string;
    readonly dispatch: (
      scheduledTime: Date,
    ) => Effect.Effect<void, never, WorkflowRunner | PlatformRuntime>;
  };
  readonly register: (
    infrastructure: Layer.Layer<RIn>,
  ) => Effect.Effect<void, WorkflowRunnerError, WorkflowRunner | PlatformRuntime | Scope.Scope>;
}

/** Creates a shared workflow registration without selecting a runtime backend. */
export const make = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
  RSteps,
  RIn,
>(
  workflow: Workflow.Workflow<Name, Payload, Success>,
  options: {
    readonly dependencies: Layer.Layer<RSteps, never, RIn>;
    readonly run: (
      payload: Schema.Struct.Type<Payload>,
      context: Workflow.Context<RSteps | RIn>,
    ) => Effect.Effect<Success["Type"], unknown, WorkflowRunner | PlatformRuntime>;
    readonly cron?: Cron<Schema.Struct.Type<Payload>>;
  },
): WorkflowRegistration<RIn> => ({
  workflow,
  ...(options.cron === undefined
    ? {}
    : {
        cron: {
          schedule: options.cron.schedule,
          dispatch: (scheduledTime: Date) =>
            Workflow.dispatchAndForget(workflow, options.cron!.payload(scheduledTime)),
        },
      }),
  register: (infrastructure) =>
    WorkflowRunner.pipe(
      Effect.flatMap((runner) =>
        runner.register(
          workflow,
          options.run,
          options.dependencies.pipe(Layer.provideMerge(infrastructure)),
        ),
      ),
    ),
});
