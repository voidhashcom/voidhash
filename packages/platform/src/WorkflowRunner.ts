import type * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import type * as Workflow from "./Workflow.ts";

/** Stable failure raised by a durable workflow runtime. */
export class WorkflowRunnerError extends Schema.TaggedErrorClass<WorkflowRunnerError>(
  "WorkflowRunnerError",
)("WorkflowRunnerError", {
  cause: Schema.String,
  operation: Schema.String,
  workflowName: Schema.String,
}) {}

/** Persisted state returned when polling a workflow execution. */
export type WorkflowExecutionResult<A> =
  | { readonly status: "interrupted" }
  | { readonly status: "suspended" }
  | { readonly status: "succeeded"; readonly value: A }
  | { readonly status: "failed"; readonly error: WorkflowRunnerError };

/** Provider-neutral durable workflow capabilities. */
export interface WorkflowRunnerShape {
  readonly register: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
    RSteps,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    run: (
      payload: Schema.Struct.Type<Payload>,
      context: Workflow.Context<RSteps>,
    ) => Effect.Effect<Success["Type"], unknown, WorkflowRunner | PlatformRuntime>,
    dependencies: Layer.Layer<RSteps>,
  ) => Effect.Effect<void, WorkflowRunnerError, Scope.Scope | PlatformRuntime>;
  readonly dispatch: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<string, WorkflowRunnerError, PlatformRuntime>;
  readonly execute: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime>;
  readonly poll: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    executionId: string,
  ) => Effect.Effect<
    Option.Option<WorkflowExecutionResult<Success["Type"]>>,
    WorkflowRunnerError,
    PlatformRuntime
  >;
  readonly resume: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
  readonly interrupt: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: Workflow.Workflow<Name, Payload, Success>,
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
}

/** Provider-neutral durable workflow runtime used by composition roots. */
export class WorkflowRunner extends Context.Service<WorkflowRunner, WorkflowRunnerShape>()(
  "@voidhash/platform/WorkflowRunner",
) {}
