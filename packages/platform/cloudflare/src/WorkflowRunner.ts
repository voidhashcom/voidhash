import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext, type BaseRuntimeContext } from "alchemy/RuntimeContext";
import { Cause, Effect, Layer, Option, Schema } from "effect";

import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as Workflow from "@voidhash/platform/Workflow";
import {
  type WorkflowExecutionResult,
  WorkflowRunner,
  WorkflowRunnerError,
  type WorkflowRunnerShape,
} from "@voidhash/platform/WorkflowRunner";

type Handle = Cloudflare.WorkflowHandle<unknown, unknown>;

class NonRetryableError extends Error {
  override readonly name = "NonRetryableError";
}

/**
 * Defect a failed durable step dies with: a `NonRetryableError` when the step
 * opted out of retries (Cloudflare Workflows treats that name as terminal),
 * otherwise the squashed original cause so the platform retries it.
 */
const stepDefect = (retry: unknown, cause: Cause.Cause<unknown>): unknown => {
  if (retry === "none") return new NonRetryableError(Cause.pretty(cause));
  return Cause.squash(cause);
};

const runnerError = (workflowName: string, operation: string, cause: unknown) =>
  new WorkflowRunnerError({ cause: String(cause), operation, workflowName });

const catchRunnerCause = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  workflowName: string,
  operation: string,
): Effect.Effect<A, WorkflowRunnerError, R> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Effect.fail(runnerError(workflowName, operation, Cause.pretty(cause))),
    ),
  );

/**
 * SHA-256 hex digest of `value`.
 *
 * WebCrypto is read directly (rather than through effect's `Crypto` service)
 * because this adapter implements a port whose methods are pinned to
 * `R = PlatformRuntime`: a `Crypto` requirement here would leak into every
 * `dispatch` caller. workerd always provides `crypto.subtle`.
 */
const sha256 = (value: string): Effect.Effect<string> =>
  // oxlint-disable-next-line effect/noGlobals -- see the doc comment above: this port's methods are pinned to `R = PlatformRuntime`, and Effect v4's `Crypto` is a `Context.Service` with no Workers-safe layer, so requiring it here would leak a `Crypto` dependency into every `dispatch` caller. workerd always provides `crypto.subtle`.
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ),
  );

const workflowHandle = (
  handles: ReadonlyMap<string, Handle>,
  workflowName: string,
  operation: string,
): Effect.Effect<Handle, WorkflowRunnerError> => {
  const handle = handles.get(workflowName);
  if (handle) return Effect.succeed(handle);
  return Effect.fail(
    runnerError(workflowName, operation, `Workflow ${workflowName} is not registered`),
  );
};

const provideRuntime = <A, E, R>(
  effect: Effect.Effect<A, E, R | PlatformRuntime | WorkflowRunner | RuntimeContext>,
  runtimeContext: BaseRuntimeContext,
  runner: WorkflowRunnerShape,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.provideService(RuntimeContext, runtimeContext),
    Effect.provideService(PlatformRuntime, PlatformRuntime.of({})),
    Effect.provideService(WorkflowRunner, runner),
  );

/** Builds a Cloudflare Workflows adapter for one Worker initialization. */
export const make = (runtimeContext: BaseRuntimeContext): WorkflowRunnerShape => {
  const handles = new Map<string, Handle>();
  let runner: WorkflowRunnerShape;

  runner = {
    register: (workflow, run, dependencies) => {
      const payloadSchema = Schema.Struct(workflow.payload);
      // oxlint-disable-next-line effect/noAs -- Cloudflare's `WorkflowImpl<unknown, unknown>` is a nominal alchemy type whose generator body cannot be structurally inferred from this closure; the cast pins the erased input/output pair. `satisfies` would demand the un-erased schema types the adapter no longer has.
      const implementation = Effect.succeed(((encodedInput: unknown) =>
        Effect.gen(function* () {
          const event = yield* Cloudflare.WorkflowEvent;
          const input = yield* Schema.decodeUnknownEffect(payloadSchema)(encodedInput).pipe(
            Effect.orDie,
          );
          const context: Workflow.Context<any> = {
            executionId: event.instanceId,
            // oxlint-disable-next-line effect/noAs -- `Workflow.Context.step` is generic per call site over the step's success schema; this adapter encodes/decodes through the erased schema, so the built function cannot be re-related to that generic signature without a cast. `satisfies` cannot widen an erased type back into a generic position.
            step: ((options) =>
              Workflow.durableOperationName(options.name).pipe(
                Effect.flatMap((name) =>
                  Cloudflare.task(
                    name,
                    provideRuntime(
                      options.execute.pipe(
                        Effect.provide(dependencies),
                        Effect.flatMap((value) =>
                          Schema.encodeUnknownEffect(options.success)(value),
                        ),
                        Effect.catchCause((cause) => Effect.die(stepDefect(options.retry, cause))),
                      ),
                      runtimeContext,
                      runner,
                    ),
                  ),
                ),
                Effect.flatMap((value) => Schema.decodeUnknownEffect(options.success)(value)),
                Effect.mapError((cause) =>
                  runnerError(workflow.name, `step:${options.name}`, cause),
                ),
              )) as Workflow.Context<any>["step"],
            // oxlint-disable-next-line effect/noAs -- `Workflow.Context.sleepUntil` is an overloaded signature that `Cloudflare.sleepUntil` cannot be structurally checked against; the `as unknown as` bridges the Cloudflare durable-sleep shape to the port's. `satisfies` cannot bridge two unrelated call signatures.
            sleepUntil: ((name: string, scheduledTime: Date) =>
              Workflow.durableOperationName(name).pipe(
                Effect.flatMap((durableName) => Cloudflare.sleepUntil(durableName, scheduledTime)),
                Effect.mapError((cause) => runnerError(workflow.name, `sleep:${name}`, cause)),
              )) as unknown as Workflow.Context<any>["sleepUntil"],
          };
          const result = yield* provideRuntime(run(input, context), runtimeContext, runner).pipe(
            Effect.orDie,
          );
          return yield* Schema.encodeUnknownEffect(workflow.success)(result).pipe(Effect.orDie);
        })) as Cloudflare.WorkflowImpl<unknown, unknown>);

      // oxlint-disable-next-line effect/noAs -- `register` in `WorkflowRunnerShape` is generic over the workflow definition, which this adapter has already erased to `Cloudflare.WorkflowImpl<unknown, unknown>`; the resulting effect cannot be re-related to the port's type parameter without a cast. `satisfies` cannot widen an erased type back into a generic position.
      return catchRunnerCause(
        Effect.gen(function* () {
          const registered = yield* Cloudflare.Workflow<never>()(workflow.name, implementation);
          handles.set(workflow.name, registered);
        }),
        workflow.name,
        "register",
      ) as never;
    },
    dispatch: (workflow, payload) =>
      // oxlint-disable-next-line effect/noAs -- `dispatch` in `WorkflowRunnerShape` is generic over the workflow definition; the adapter works with the erased `Schema.Struct(workflow.payload)`, so the produced effect cannot be re-related to the port's type parameter without a cast. `satisfies` cannot widen an erased type back into a generic position.
      catchRunnerCause(
        Effect.gen(function* () {
          yield* PlatformRuntime;
          const handle = yield* workflowHandle(handles, workflow.name, "dispatch");
          const encoded = yield* Schema.encodeUnknownEffect(Schema.Struct(workflow.payload))(
            payload,
          );
          const executionId = yield* sha256(workflow.idempotencyKey(payload));
          const instance = yield* handle
            .create({ id: executionId, params: encoded })
            .pipe(Effect.catchCause(() => handle.get(executionId)));
          return instance.id;
        }),
        workflow.name,
        "dispatch",
      ) as never,
    execute: (workflow, payload) =>
      catchRunnerCause(
        Effect.gen(function* () {
          const executionId = yield* runner.dispatch(workflow, payload);
          while (true) {
            const result = yield* runner.poll(workflow, executionId);
            if (Option.isSome(result)) {
              if (result.value.status === "succeeded") return result.value.value;
              if (result.value.status === "failed") return yield* result.value.error;
              if (result.value.status === "interrupted") {
                return yield* runnerError(workflow.name, "execute", "Workflow interrupted");
              }
            }
            yield* Effect.sleep("250 millis");
          }
        }),
        workflow.name,
        "execute",
      ),
    poll: (workflow, executionId) =>
      // oxlint-disable-next-line effect/noAs -- `poll` in `WorkflowRunnerShape` is generic over the workflow's success type; this adapter only sees the erased `Schema`, so the concrete `Option<WorkflowExecutionResult<…>>` cannot be re-related to the port's type parameter without a cast. `satisfies` cannot widen an erased type back into a generic position.
      catchRunnerCause(
        Effect.gen(function* () {
          yield* PlatformRuntime;
          const handle = yield* workflowHandle(handles, workflow.name, "poll");
          const instance = yield* handle.get(executionId);
          const status = yield* instance.status();

          if (status.status === "terminated") {
            return Option.some<WorkflowExecutionResult<never>>({ status: "interrupted" });
          }
          if (status.status === "errored") {
            return Option.some<WorkflowExecutionResult<never>>({
              status: "failed",
              error: runnerError(workflow.name, "poll", status.error?.message ?? "Workflow failed"),
            });
          }
          if (status.status === "complete") {
            const value = yield* Schema.decodeUnknownEffect(workflow.success)(status.output);
            return Option.some<WorkflowExecutionResult<typeof value>>({
              status: "succeeded",
              value,
            });
          }
          if (status.status === "unknown") return Option.none();
          return Option.some<WorkflowExecutionResult<never>>({ status: "suspended" });
        }),
        workflow.name,
        "poll",
      ) as never,
    resume: (workflow, executionId) =>
      catchRunnerCause(
        Effect.gen(function* () {
          yield* PlatformRuntime;
          const handle = yield* workflowHandle(handles, workflow.name, "resume");
          const instance = yield* handle.get(executionId);
          yield* instance.resume();
        }),
        workflow.name,
        "resume",
      ),
    interrupt: (workflow, executionId) =>
      catchRunnerCause(
        Effect.gen(function* () {
          yield* PlatformRuntime;
          const handle = yield* workflowHandle(handles, workflow.name, "interrupt");
          const instance = yield* handle.get(executionId);
          yield* instance.terminate();
        }),
        workflow.name,
        "interrupt",
      ),
  };

  return runner;
};

/** Provides a Cloudflare workflow runner from the current Alchemy runtime. */
export const layer: Layer.Layer<WorkflowRunner, never, RuntimeContext> = Layer.effect(
  WorkflowRunner,
  RuntimeContext.pipe(Effect.map(make)),
);
