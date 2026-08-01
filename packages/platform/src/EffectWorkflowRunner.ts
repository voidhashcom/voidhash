import { Cause, Effect, Exit, Layer, Option, Schema } from "effect";
import { Activity, DurableClock, Workflow, WorkflowEngine } from "effect/unstable/workflow";

import { PlatformRuntime } from "./PlatformRuntime.ts";
import {
  type WorkflowDefinition,
  type WorkflowExecutionResult,
  type WorkflowHandlerContext,
  WorkflowRunner,
  WorkflowRunnerError,
  type WorkflowRunnerShape,
  type WorkflowStepOptions,
} from "./Workflow.ts";

/**
 * Maps the provider-neutral `WorkflowRunner` contract onto Effect's
 * `WorkflowEngine`.
 *
 * This lives beside the contracts rather than in one adapter because every
 * backend built on Effect's durable-execution primitives shares the mapping;
 * only the engine underneath differs (Postgres tables, cluster entities, an
 * in-memory engine for tests). Backends that are not Effect-based implement
 * `WorkflowRunner` directly instead.
 */
const runnerError = (workflowName: string, operation: string, cause: unknown) =>
  new WorkflowRunnerError({ workflowName, operation, cause: String(cause) });

const catchRunnerCause = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  workflowName: string,
  operation: string,
): Effect.Effect<A, WorkflowRunnerError, R> =>
  effect.pipe(
    Effect.catchCause((cause) => {
      const squashed = Cause.squash(cause);
      return Effect.fail(
        squashed instanceof WorkflowRunnerError
          ? squashed
          : runnerError(workflowName, operation, Cause.pretty(cause)),
      );
    }),
  );

const toNativeWorkflow = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: WorkflowDefinition<Name, Payload, Success>,
) =>
  Workflow.make(workflow.name, {
    payload: workflow.payload,
    success: workflow.success,
    error: WorkflowRunnerError,
    idempotencyKey: workflow.idempotencyKey,
  });

const executionResult = <A>(
  result: Workflow.Result<A, WorkflowRunnerError>,
): Effect.Effect<WorkflowExecutionResult<A>> => {
  if (result._tag === "Suspended") {
    return Effect.succeed({ status: "suspended" });
  }
  return Effect.succeed(
    Exit.match(result.exit, {
      onFailure: (cause) => {
        if (Cause.hasInterrupts(cause)) {
          return { status: "interrupted" as const };
        }
        const error = Cause.squash(cause);
        return {
          status: "failed" as const,
          error: error instanceof WorkflowRunnerError ? error : runnerError("unknown", "poll", error),
        };
      },
      onSuccess: (value) => ({ status: "succeeded" as const, value }),
    }),
  );
};

const makeStep = <Success extends Schema.Top, R>(
  workflowName: string,
  options: WorkflowStepOptions<Success, R>,
): Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime | R> =>
  Activity.make({
    name: options.name,
    success: options.success,
    error: WorkflowRunnerError,
    execute: catchRunnerCause(
      PlatformRuntime.pipe(Effect.andThen(options.execute)),
      workflowName,
      `step:${options.name}`,
    ),
  }) as unknown as Effect.Effect<Success["Type"], WorkflowRunnerError, PlatformRuntime | R>;

const sleepUntil = (
  workflowName: string,
  name: string,
  scheduledTime: Date,
): Effect.Effect<void, WorkflowRunnerError, PlatformRuntime> =>
  catchRunnerCause(
    PlatformRuntime.pipe(
      Effect.andThen(
        Effect.suspend(() => {
          const delay = scheduledTime.getTime() - Date.now();
          return delay <= 0
            ? Effect.void
            : DurableClock.sleep({ name, duration: delay, inMemoryThreshold: 1 });
        }),
      ),
    ),
    workflowName,
    `sleep:${name}`,
  ) as unknown as Effect.Effect<void, WorkflowRunnerError, PlatformRuntime>;

type AnyWorkflowDefinition = WorkflowDefinition<string, Schema.Struct.Fields, Schema.Top>;

type AnyWorkflowHandler = (
  payload: Schema.Struct.Type<Schema.Struct.Fields>,
  context: WorkflowHandlerContext,
) => Effect.Effect<unknown, unknown, unknown>;

/** Builds the provider-neutral runner facade over one Effect workflow engine. */
export const makeEffectWorkflowRunner = (
  engine: WorkflowEngine.WorkflowEngine["Service"],
): WorkflowRunnerShape =>
  ({
    register: (workflow: AnyWorkflowDefinition, handler: AnyWorkflowHandler) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        engine.register(native, (payload, executionId) => {
          const context: WorkflowHandlerContext = {
            executionId,
            step: (options) => makeStep(workflow.name, options),
            sleepUntil: (name, scheduledTime) => sleepUntil(workflow.name, name, scheduledTime),
          };
          return catchRunnerCause(
            PlatformRuntime.pipe(Effect.andThen(handler(payload, context))),
            workflow.name,
            "run",
            // Activities and durable clocks inside the body resolve the engine
            // from context. Engines differ in whether they install themselves
            // around a handler, so the runner always does it.
          ).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
        }),
        workflow.name,
        "register",
      );
    },
    dispatch: (
      workflow: AnyWorkflowDefinition,
      payload: Schema.Struct.Type<Schema.Struct.Fields>,
    ) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        PlatformRuntime.pipe(
          Effect.andThen(native.execute(payload, { discard: true })),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        ),
        workflow.name,
        "dispatch",
      );
    },
    execute: (
      workflow: AnyWorkflowDefinition,
      payload: Schema.Struct.Type<Schema.Struct.Fields>,
    ) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        PlatformRuntime.pipe(
          Effect.andThen(native.execute(payload)),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        ),
        workflow.name,
        "execute",
      );
    },
    poll: (workflow: AnyWorkflowDefinition, executionId: string) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        PlatformRuntime.pipe(
          Effect.andThen(native.poll(executionId)),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeedNone,
              onSome: (result) => executionResult(result).pipe(Effect.map(Option.some)),
            }),
          ),
        ),
        workflow.name,
        "poll",
      );
    },
    resume: (workflow: AnyWorkflowDefinition, executionId: string) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        PlatformRuntime.pipe(
          Effect.andThen(native.resume(executionId)),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        ),
        workflow.name,
        "resume",
      );
    },
    interrupt: (workflow: AnyWorkflowDefinition, executionId: string) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        PlatformRuntime.pipe(
          Effect.andThen(native.interrupt(executionId)),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        ),
        workflow.name,
        "interrupt",
      );
    },
  }) as unknown as WorkflowRunnerShape;

/**
 * Provides `WorkflowRunner` from whichever Effect `WorkflowEngine` is in
 * context, so an adapter only has to supply its engine layer.
 */
export const EffectWorkflowRunnerLive: Layer.Layer<
  WorkflowRunner,
  never,
  WorkflowEngine.WorkflowEngine
> = Layer.effect(WorkflowRunner, Effect.map(WorkflowEngine.WorkflowEngine, makeEffectWorkflowRunner));
