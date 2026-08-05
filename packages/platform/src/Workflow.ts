import type { Option, Schema } from "effect";
import { Effect } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import {
  WorkflowRunner,
  type WorkflowExecutionResult,
  type WorkflowRunnerError,
} from "./WorkflowRunner.ts";

/** Provider-neutral durable workflow definition. */
export interface Workflow<
  Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
> {
  readonly name: Name;
  readonly payload: Payload;
  readonly success: Success;
  readonly idempotencyKey: (payload: Schema.Struct.Type<Payload>) => string;
}

/** Any provider-neutral durable workflow definition. */
export type Any = Workflow<string, any, any>;

/** Retry policy understood by every workflow adapter. */
export type StepRetry = "platform-default" | "none";

/** Options for one durable workflow activity. */
export interface StepOptions<Success extends Schema.Top, RSteps> {
  readonly name: string;
  readonly success: Success;
  readonly execute: Effect.Effect<
    Success["Type"],
    unknown,
    RSteps | WorkflowRunner | PlatformRuntime
  >;
  readonly retry?: StepRetry;
}

/** Durable operations available while a workflow handler is running. */
export interface Context<RSteps> {
  readonly executionId: string;
  readonly step: <Success extends Schema.Top>(
    options: StepOptions<Success, RSteps>,
  ) => Effect.Effect<Success["Type"], WorkflowRunnerError, WorkflowRunner | PlatformRuntime>;
  readonly sleepUntil: (
    name: string,
    scheduledTime: Date,
  ) => Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;
}

const MAX_DURABLE_OPERATION_NAME_BYTES = 96;

/**
 * Bounds a task or clock name for durable backends while preserving short,
 * readable names verbatim. Long names use a readable prefix plus the complete
 * SHA-256 digest, so identifiers accepted by workflow payload schemas cannot
 * overflow a provider's composed persistence key.
 */
export const durableOperationName = (name: string): Effect.Effect<string> => {
  const encoded = new TextEncoder().encode(name);
  if (encoded.byteLength <= MAX_DURABLE_OPERATION_NAME_BYTES) return Effect.succeed(name);

  return Effect.promise(async () => {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
    const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const prefix = name.slice(0, 24).replaceAll(/[^a-zA-Z0-9._-]/g, "_");
    return `${prefix}:${hash}`;
  });
};

/** Defines a provider-neutral workflow while preserving schema inference. */
export const define = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  definition: Workflow<Name, Payload, Success>,
): Workflow<Name, Payload, Success> => definition;

/** Starts a workflow and returns its stable execution ID. */
export const dispatch = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  payload: Schema.Struct.Type<Payload>,
): Effect.Effect<string, WorkflowRunnerError, WorkflowRunner | PlatformRuntime> =>
  WorkflowRunner.pipe(Effect.flatMap((runner) => runner.dispatch(workflow, payload)));

/** Starts a workflow, logging and terminating the caller fiber if dispatch fails. */
export const dispatchAndForget = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  payload: Schema.Struct.Type<Payload>,
): Effect.Effect<void, never, WorkflowRunner | PlatformRuntime> =>
  dispatch(workflow, payload).pipe(
    Effect.tapError((error) =>
      Effect.logError("Failed to dispatch workflow", {
        error,
        workflowName: workflow.name,
      }),
    ),
    Effect.orDie,
    Effect.asVoid,
  );

/** Starts or joins a workflow and awaits successful completion. */
export const execute = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  payload: Schema.Struct.Type<Payload>,
): Effect.Effect<Success["Type"], WorkflowRunnerError, WorkflowRunner | PlatformRuntime> =>
  WorkflowRunner.pipe(Effect.flatMap((runner) => runner.execute(workflow, payload)));

/** Reads one persisted workflow execution result. */
export const poll = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  executionId: string,
): Effect.Effect<
  Option.Option<WorkflowExecutionResult<Success["Type"]>>,
  WorkflowRunnerError,
  WorkflowRunner | PlatformRuntime
> => WorkflowRunner.pipe(Effect.flatMap((runner) => runner.poll(workflow, executionId)));

/** Resumes a suspended workflow execution. */
export const resume = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  executionId: string,
): Effect.Effect<void, WorkflowRunnerError, WorkflowRunner | PlatformRuntime> =>
  WorkflowRunner.pipe(Effect.flatMap((runner) => runner.resume(workflow, executionId)));

/** Interrupts a workflow execution. */
export const interrupt = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: Workflow<Name, Payload, Success>,
  executionId: string,
): Effect.Effect<void, WorkflowRunnerError, WorkflowRunner | PlatformRuntime> =>
  WorkflowRunner.pipe(Effect.flatMap((runner) => runner.interrupt(workflow, executionId)));
