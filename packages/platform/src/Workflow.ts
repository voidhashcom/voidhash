import type { Effect, Option, Scope } from "effect";
import { Context, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised by a durable workflow runtime. */
export class WorkflowRunnerError extends Schema.TaggedErrorClass<WorkflowRunnerError>(
  "WorkflowRunnerError",
)("WorkflowRunnerError", {
  cause: Schema.String,
  operation: Schema.String,
  workflowName: Schema.String,
}) {}

/** Provider-neutral durable workflow definition. */
export interface WorkflowDefinition<
  Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
> {
  readonly name: Name;
  readonly payload: Payload;
  readonly success: Success;
  readonly idempotencyKey: (payload: Schema.Struct.Type<Payload>) => string;
}

/** Options for one durable workflow activity. */
export interface WorkflowStepOptions<Success extends Schema.Top, R> {
  readonly name: string;
  readonly success: Success;
  readonly execute: Effect.Effect<Success["Type"], unknown, R>;
}

/** Durable operations available while a workflow handler is running. */
export interface WorkflowHandlerContext {
  readonly executionId: string;
  readonly step: <Success extends Schema.Top, R>(
    options: WorkflowStepOptions<Success, R>,
  ) => Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime | R>;
  readonly sleepUntil: (
    name: string,
    scheduledTime: Date,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
}

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
    R,
  >(
    workflow: WorkflowDefinition<Name, Payload, Success>,
    handler: (
      payload: Schema.Struct.Type<Payload>,
      context: WorkflowHandlerContext,
    ) => Effect.Effect<Success["Type"], unknown, R>,
  ) => Effect.Effect<void, WorkflowRunnerError, Scope.Scope | PlatformRuntime | R>;
  readonly dispatch: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: WorkflowDefinition<Name, Payload, Success>,
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<string, WorkflowRunnerError, PlatformRuntime>;
  readonly execute: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: WorkflowDefinition<Name, Payload, Success>,
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime>;
  readonly poll: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: WorkflowDefinition<Name, Payload, Success>,
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
    workflow: WorkflowDefinition<Name, Payload, Success>,
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
  readonly interrupt: <
    Name extends string,
    Payload extends Schema.Struct.Fields,
    Success extends Schema.Top,
  >(
    workflow: WorkflowDefinition<Name, Payload, Success>,
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
}

/** Provider-neutral durable workflow runtime used by composition roots. */
export class WorkflowRunner extends Context.Service<WorkflowRunner, WorkflowRunnerShape>()(
  "@voidhash/platform/WorkflowRunner",
) {}

/** Defines a provider-neutral workflow while preserving schema inference. */
export const defineWorkflow = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  definition: WorkflowDefinition<Name, Payload, Success>,
): WorkflowDefinition<Name, Payload, Success> => definition;
