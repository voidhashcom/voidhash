import { Cause, Clock, Effect, Exit, Layer, Option, Schema } from "effect";
import { Activity, DurableClock, Workflow, WorkflowEngine } from "effect/unstable/workflow";

import { PlatformRuntime } from "./PlatformRuntime.ts";
import * as WorkflowContract from "./Workflow.ts";
import {
  type WorkflowExecutionResult,
  WorkflowRunner,
  WorkflowRunnerError,
  type WorkflowRunnerShape,
} from "./WorkflowRunner.ts";

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

/**
 * Bridges the one boundary where Effect's native workflow types and the
 * provider-neutral contract cannot meet.
 *
 * Activities, durable clocks and native workflow handles advertise the
 * `WorkflowEngine` and workflow-instance requirements that this runner installs
 * around every handler, and their generic parameters are wider than the
 * contract's. The runtime values already satisfy the contract, so the gap is
 * funnelled through this single helper instead of being restated at every call
 * site.
 */
const asContract: <T>(value: any) => T = (value) => value;

const catchRunnerCause = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  workflowName: string,
  operation: string,
): Effect.Effect<A, WorkflowRunnerError, R> =>
  effect.pipe(
    Effect.catchCause((cause) => {
      const squashed = Cause.squash(cause);
      if (squashed instanceof WorkflowRunnerError) return Effect.fail(squashed);
      return Effect.fail(runnerError(workflowName, operation, Cause.pretty(cause)));
    }),
  );

const toNativeWorkflow = <
  const Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  workflow: WorkflowContract.Workflow<Name, Payload, Success>,
) =>
  Workflow.make(workflow.name, {
    payload: workflow.payload,
    success: workflow.success,
    error: WorkflowRunnerError,
    idempotencyKey: workflow.idempotencyKey,
  });

const failureResult = (cause: Cause.Cause<WorkflowRunnerError>): WorkflowExecutionResult<never> => {
  if (Cause.hasInterrupts(cause)) {
    return { status: "interrupted" };
  }
  const error = Cause.squash(cause);
  if (error instanceof WorkflowRunnerError) {
    return { status: "failed", error };
  }
  return { status: "failed", error: runnerError("unknown", "poll", error) };
};

const executionResult = <A>(
  result: Workflow.Result<A, WorkflowRunnerError>,
): Effect.Effect<WorkflowExecutionResult<A>> => {
  if (result._tag === "Suspended") {
    return Effect.succeed({ status: "suspended" });
  }
  return Effect.succeed(
    Exit.match(result.exit, {
      onFailure: failureResult,
      onSuccess: (value): WorkflowExecutionResult<A> => ({ status: "succeeded", value }),
    }),
  );
};

/**
 * Extra attempts a `platform-default` step gets in process.
 *
 * `Activity.make` installs no failure-retry policy of its own — its only
 * built-in schedule covers interrupts — so without this a step would run once
 * here while Cloudflare Workflows retries the same step five times. The count
 * mirrors the platform default; the delays deliberately do not, because this
 * runner backs local development and unit tests where the behaviour that has to
 * match production is *retried versus not*, not the wall-clock backoff.
 */
const PLATFORM_DEFAULT_STEP_RETRIES = 5;

const withStepRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  retry: WorkflowContract.StepRetry | undefined,
): Effect.Effect<A, E, R> => {
  if (retry === "none") return effect;
  return Activity.retry(effect, { times: PLATFORM_DEFAULT_STEP_RETRIES });
};

const makeStep = <Success extends Schema.Top, R>(
  workflowName: string,
  dependencies: Layer.Layer<R>,
  options: WorkflowContract.StepOptions<Success, R>,
): Effect.Effect<Success["Type"], WorkflowRunnerError, WorkflowRunner | PlatformRuntime> =>
  WorkflowContract.durableOperationName(options.name).pipe(
    Effect.flatMap((name) =>
      asContract<Effect.Effect<Success["Type"], WorkflowRunnerError, WorkflowRunner | PlatformRuntime>>(
        Activity.make({
          name,
          success: options.success,
          error: WorkflowRunnerError,
          execute: catchRunnerCause(
            withStepRetry(
              PlatformRuntime.pipe(
                Effect.andThen(options.execute.pipe(Effect.provide(dependencies))),
              ),
              options.retry,
            ),
            workflowName,
            `step:${options.name}`,
          ),
        }),
      ),
    ),
  );

const sleepUntil = (
  workflowName: string,
  name: string,
  scheduledTime: Date,
): Effect.Effect<void, WorkflowRunnerError, PlatformRuntime> =>
  asContract(
    WorkflowContract.durableOperationName(name).pipe(
      Effect.flatMap((durableName) =>
        catchRunnerCause(
          PlatformRuntime.pipe(
            Effect.andThen(
              Effect.gen(function* () {
                const delay = scheduledTime.getTime() - (yield* Clock.currentTimeMillis);
                if (delay <= 0) return;
                yield* DurableClock.sleep({
                  name: durableName,
                  duration: delay,
                  inMemoryThreshold: 1,
                });
              }),
            ),
          ),
          workflowName,
          `sleep:${name}`,
        ),
      ),
    ),
  );

type AnyWorkflowDefinition = WorkflowContract.Workflow<string, Schema.Struct.Fields, Schema.Top>;

type AnyWorkflowHandler<RSteps> = (
  payload: Schema.Struct.Type<Schema.Struct.Fields>,
  context: WorkflowContract.Context<RSteps>,
) => Effect.Effect<unknown, unknown, WorkflowRunner | PlatformRuntime>;

/** Builds the provider-neutral runner facade over one Effect workflow engine. */
export const make = (engine: WorkflowEngine.WorkflowEngine["Service"]): WorkflowRunnerShape =>
  asContract({
    register: <RSteps>(
      workflow: AnyWorkflowDefinition,
      handler: AnyWorkflowHandler<RSteps>,
      dependencies: Layer.Layer<RSteps>,
    ) => {
      const native = toNativeWorkflow(workflow);
      return catchRunnerCause(
        engine.register(native, (payload, executionId) => {
          const context: WorkflowContract.Context<RSteps> = {
            executionId,
            step: (options) => makeStep(workflow.name, dependencies, options),
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
  });

/**
 * Provides `WorkflowRunner` from whichever Effect `WorkflowEngine` is in
 * context, so an adapter only has to supply its engine layer.
 */
export const layer: Layer.Layer<WorkflowRunner, never, WorkflowEngine.WorkflowEngine> =
  Layer.effect(WorkflowRunner, Effect.map(WorkflowEngine.WorkflowEngine, make));
