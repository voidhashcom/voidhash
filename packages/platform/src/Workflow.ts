import type { Option, Scope } from "effect";
import { Context, Effect, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import type { PrimitiveDefinition } from "./Primitive.ts";

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

/**
 * A workflow definition bundled with its handler, so a single declaration
 * carries both the client operations and the body every runtime registers.
 */
export interface WorkflowProgram<
  Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
  R,
> extends WorkflowDefinition<Name, Payload, Success>,
    PrimitiveDefinition<"workflow", Name> {
  readonly run: (
    payload: Schema.Struct.Type<Payload>,
    context: WorkflowHandlerContext,
  ) => Effect.Effect<Success["Type"], unknown, R>;
  /** Registers this workflow handler in the installed runtime. */
  readonly register: Effect.Effect<
    void,
    WorkflowRunnerError,
    Scope.Scope | PlatformRuntime | WorkflowRunner | R
  >;
  /** Starts the workflow and returns its stable execution ID. */
  readonly dispatch: (
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<string, WorkflowRunnerError, PlatformRuntime | WorkflowRunner>;
  /** Starts or joins the workflow and awaits successful completion. */
  readonly execute: (
    payload: Schema.Struct.Type<Payload>,
  ) => Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime | WorkflowRunner>;
  /** Reads one persisted execution result. */
  readonly poll: (
    executionId: string,
  ) => Effect.Effect<
    Option.Option<WorkflowExecutionResult<Success["Type"]>>,
    WorkflowRunnerError,
    PlatformRuntime | WorkflowRunner
  >;
  /** Resumes a suspended workflow execution. */
  readonly resume: (
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime | WorkflowRunner>;
  /** Interrupts a workflow execution. */
  readonly interrupt: (
    executionId: string,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime | WorkflowRunner>;
}

/** Creates a durable workflow program without selecting a runtime backend. */
export const defineWorkflowProgram = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
  R,
>(
  definition: WorkflowDefinition<Name, Payload, Success> & {
    readonly run: (
      payload: Schema.Struct.Type<Payload>,
      context: WorkflowHandlerContext,
    ) => Effect.Effect<Success["Type"], unknown, R>;
  },
): WorkflowProgram<Name, Payload, Success, R> => {
  const workflow = defineWorkflow(definition);
  return {
    ...definition,
    kind: "workflow",
    register: WorkflowRunner.pipe(
      Effect.flatMap((runner) => runner.register(workflow, definition.run)),
    ),
    dispatch: (payload) =>
      WorkflowRunner.pipe(Effect.flatMap((runner) => runner.dispatch(workflow, payload))),
    execute: (payload) =>
      WorkflowRunner.pipe(Effect.flatMap((runner) => runner.execute(workflow, payload))),
    poll: (executionId) =>
      WorkflowRunner.pipe(Effect.flatMap((runner) => runner.poll(workflow, executionId))),
    resume: (executionId) =>
      WorkflowRunner.pipe(Effect.flatMap((runner) => runner.resume(workflow, executionId))),
    interrupt: (executionId) =>
      WorkflowRunner.pipe(Effect.flatMap((runner) => runner.interrupt(workflow, executionId))),
  };
};
