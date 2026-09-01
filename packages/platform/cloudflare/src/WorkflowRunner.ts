import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext, type BaseRuntimeContext } from "alchemy/RuntimeContext";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
  Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    catch: (cause) => cause,
  }).pipe(
    Effect.orDie,
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ),
  );

const workflowHandle = (
  handles: MutableHashMap.MutableHashMap<string, Handle>,
  workflowName: string,
  operation: string,
): Effect.Effect<Handle, WorkflowRunnerError> => {
  const handle = MutableHashMap.get(handles, workflowName);
  if (Option.isSome(handle)) return Effect.succeed(handle.value);
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

const asContract: <T>(value: any) => T = (value) => value;

/** Observability wiring for the Cloudflare Workflows adapter. */
export interface WorkflowRunnerTelemetryOptions {
  /**
   * Exporter layer provided around each workflow run body AND around each
   * durable step.
   *
   * The per-STEP provide is the load-bearing one: steps are separated by
   * durable sleeps and instance evictions, so a run-scoped exporter would be
   * frozen (and its buffer lost) at the first durable boundary. Defaults to
   * `Layer.empty`, which leaves workflows on Effect's free no-op tracer.
   */
  readonly telemetry?: Layer.Layer<never>;
}

/** Builds a Cloudflare Workflows adapter for one Worker initialization. */
export const make = (
  runtimeContext: BaseRuntimeContext,
  options: WorkflowRunnerTelemetryOptions = {},
): WorkflowRunnerShape => {
  const telemetry = options.telemetry ?? Layer.empty;
  const handles = MutableHashMap.empty<string, Handle>();
  let runner: WorkflowRunnerShape;

  runner = {
    register: (workflow, run, dependencies) => {
      const payload = Schema.Struct(workflow.payload);
      const implementation = asContract<Effect.Effect<Cloudflare.WorkflowImpl<unknown, unknown>>>(
        Effect.succeed((encodedInput: unknown) =>
          Effect.gen(function* () {
            const event = yield* Cloudflare.WorkflowEvent;
            const input = yield* Schema.decodeUnknownEffect(payload)(encodedInput).pipe(
              Effect.orDie,
            );
            const context: Workflow.Context<any> = {
              executionId: event.instanceId,
              step: asContract<Workflow.Context<any>["step"]>(
                (options: Workflow.StepOptions<any, any>) =>
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
                            Effect.catchCause((cause) =>
                              Effect.die(stepDefect(options.retry, cause)),
                            ),
                          ),
                          runtimeContext,
                          runner,
                        ).pipe(
                          Effect.withSpan(`workflow.step ${workflow.name}/${options.name}`, {
                            attributes: {
                              "voidhash.workflow.name": workflow.name,
                              "voidhash.workflow.step": options.name,
                            },
                          }),
                          Effect.provide(telemetry),
                        ),
                      ),
                    ),
                    Effect.flatMap((value) => Schema.decodeUnknownEffect(options.success)(value)),
                    Effect.mapError((cause) =>
                      runnerError(workflow.name, `step:${options.name}`, cause),
                    ),
                  ),
              ),
              sleepUntil: asContract<Workflow.Context<any>["sleepUntil"]>(
                (name: string, scheduledTime: Date) =>
                  Workflow.durableOperationName(name).pipe(
                    Effect.flatMap((durableName) =>
                      Cloudflare.sleepUntil(durableName, scheduledTime),
                    ),
                    Effect.mapError((cause) => runnerError(workflow.name, `sleep:${name}`, cause)),
                  ),
              ),
            };
            const result = yield* provideRuntime(run(input, context), runtimeContext, runner).pipe(
              Effect.orDie,
            );
            return yield* Schema.encodeUnknownEffect(workflow.success)(result).pipe(Effect.orDie);
          }).pipe(
            // Cloudflare replays the whole body on every resume, so this span
            // measures the CURRENT invocation rather than wall-clock run time —
            // its value is the run OUTCOME (a failed run fails the span). Step
            // spans carry the per-step timings and flush at their own boundaries.
            Effect.withSpan(`workflow.run ${workflow.name}`, {
              attributes: { "voidhash.workflow.name": workflow.name },
            }),
            Effect.provide(telemetry),
          ),
        ),
      );

      return asContract(
        catchRunnerCause(
          Effect.gen(function* () {
            const registered = yield* Cloudflare.Workflow<never>()(workflow.name, implementation);
            MutableHashMap.set(handles, workflow.name, registered);
          }),
          workflow.name,
          "register",
        ),
      );
    },
    dispatch: (workflow, payload) =>
      asContract(
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
        ),
      ),
    execute: (workflow, payload) =>
      catchRunnerCause(
        Effect.gen(function* () {
          const executionId = yield* runner.dispatch(workflow, payload);
          const completed = yield* runner.poll(workflow, executionId).pipe(
            Effect.flatMap((result) => {
              if (Option.isNone(result) || result.value.status === "suspended") {
                return Effect.sleep("250 millis").pipe(Effect.as(Option.none()));
              }
              if (result.value.status === "succeeded")
                return Effect.succeed(Option.some(result.value.value));
              if (result.value.status === "failed") return result.value.error;
              return runnerError(workflow.name, "execute", "Workflow interrupted");
            }),
            Effect.repeat({ until: Option.isSome }),
          );
          return yield* Option.match(completed, {
            onNone: () => Effect.die("Workflow polling completed without a result"),
            onSome: Effect.succeed,
          });
        }),
        workflow.name,
        "execute",
      ),
    poll: (workflow, executionId) =>
      asContract(
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
                error: runnerError(
                  workflow.name,
                  "poll",
                  status.error?.message ?? "Workflow failed",
                ),
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
        ),
      ),
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

/**
 * Provides a Cloudflare workflow runner from the current Alchemy runtime,
 * optionally exporting a `workflow.run` / `workflow.step` span per invocation.
 */
export const makeLayer = (
  options: WorkflowRunnerTelemetryOptions = {},
): Layer.Layer<WorkflowRunner, never, RuntimeContext> =>
  Layer.effect(
    WorkflowRunner,
    RuntimeContext.pipe(Effect.map((runtimeContext) => make(runtimeContext, options))),
  );

/** Provides a Cloudflare workflow runner from the current Alchemy runtime. */
export const layer: Layer.Layer<WorkflowRunner, never, RuntimeContext> = makeLayer();
