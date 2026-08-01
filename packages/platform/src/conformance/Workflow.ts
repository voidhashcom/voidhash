import { Effect, Layer, Schedule, type Scope, Schema } from "effect";
import { describe, expect, it } from "vitest";

import type { PlatformRuntime } from "../PlatformRuntime.ts";
import { defineWorkflow, WorkflowRunner } from "../Workflow.ts";

/** Wiring one adapter must supply for the workflow conformance suite. */
export interface WorkflowConformanceOptions {
  readonly name: string;
  /** Builds an isolated runner; called once per test so state never leaks. */
  readonly layer: () => Layer.Layer<WorkflowRunner | PlatformRuntime>;
}

/**
 * Durable backends keep completed executions forever, and an execution ID is
 * derived from the idempotency key. Without a per-run suffix a second run of
 * this suite would join the previous run's finished executions and observe no
 * handler side effects.
 */
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const Greet = defineWorkflow({
  name: "conformance-greet",
  payload: { subject: Schema.String },
  success: Schema.String,
  idempotencyKey: (payload) => payload.subject,
});

/**
 * Behaviour every durable workflow runner must exhibit: a registered workflow
 * runs to a persisted result, steps inside it are durable units, and the
 * execution ID derived from the idempotency key makes a repeated dispatch join
 * the original run instead of starting a second one.
 */
export const workflowRunnerConformance = (options: WorkflowConformanceOptions): void => {
  // Registering a workflow handler is scoped: the handler stays installed for
  // the lifetime of the scope, so each test discharges its own.
  const run = <A, E>(
    effect: Effect.Effect<A, E, WorkflowRunner | PlatformRuntime | Scope.Scope>,
  ): Promise<A> =>
    Effect.runPromise(
      Effect.scoped(effect.pipe(Effect.provide(options.layer()))) as Effect.Effect<A, E>,
    );

  /**
   * Waits for a dispatched execution to reach a persisted result.
   *
   * `dispatch` only starts a workflow; backends that run it on another fiber or
   * another runner settle it after the call returns, so the suite polls instead
   * of assuming the result is already there.
   */
  const awaitResult = (executionId: string) =>
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      return yield* Effect.retry(
        runner
          .poll(Greet, executionId)
          .pipe(
            Effect.flatMap((result) =>
              result._tag === "Some" && result.value.status !== "suspended"
                ? Effect.succeed(result)
                : Effect.fail("pending" as const),
            ),
          ),
        { times: 100, schedule: Schedule.spaced("20 millis") },
      );
    });

  describe(`${options.name}: workflow runner conformance`, () => {
    it("executes a registered workflow and returns its result", async () => {
      const result = await run(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(Greet, (payload) => Effect.succeed(`hello ${payload.subject}`));
          return yield* runner.execute(Greet, { subject: `world-${runId}` });
        }),
      );

      expect(result).toBe(`hello world-${runId}`);
    });

    it("runs durable steps inside a workflow body", async () => {
      const steps: Array<string> = [];

      const result = await run(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(Greet, (payload, context) =>
            Effect.gen(function* () {
              const upper = yield* context.step({
                name: "shout",
                success: Schema.String,
                execute: Effect.sync(() => {
                  steps.push("shout");
                  return payload.subject.toUpperCase();
                }),
              });
              return `hello ${upper}`;
            }),
          );
          return yield* runner.execute(Greet, { subject: `steps-${runId}` });
        }),
      );

      expect(result).toBe(`hello ${`steps-${runId}`.toUpperCase()}`);
      expect(steps).toEqual(["shout"]);
    });

    it("derives a stable execution ID from the idempotency key", async () => {
      const started: Array<string> = [];

      const [first, second] = await run(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(Greet, (payload) =>
            Effect.sync(() => {
              started.push(payload.subject);
              return `hello ${payload.subject}`;
            }),
          );
          const first = yield* runner.dispatch(Greet, { subject: `same-${runId}` });
          yield* awaitResult(first);
          const second = yield* runner.dispatch(Greet, { subject: `same-${runId}` });
          yield* awaitResult(second);
          return [first, second] as const;
        }),
      );

      expect(first).toBe(second);
      // The second dispatch joins the completed run rather than re-running it.
      expect(started).toEqual([`same-${runId}`]);
    });

    it("polls a completed execution", async () => {
      const polled = await run(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(Greet, (payload) => Effect.succeed(`hello ${payload.subject}`));
          const executionId = yield* runner.dispatch(Greet, { subject: `polled-${runId}` });
          return yield* awaitResult(executionId);
        }),
      );

      expect(polled._tag).toBe("Some");
      if (polled._tag === "Some") {
        expect(polled.value.status).toBe("succeeded");
        if (polled.value.status === "succeeded") {
          expect(polled.value.value).toBe(`hello polled-${runId}`);
        }
      }
    });

    it("reports a failing workflow as a failed execution", async () => {
      const polled = await run(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(Greet, () => Effect.fail("boom"));
          const executionId = yield* runner.dispatch(Greet, { subject: `failing-${runId}` });
          return yield* awaitResult(executionId);
        }),
      );

      expect(polled._tag).toBe("Some");
      if (polled._tag === "Some") {
        expect(polled.value.status).toBe("failed");
      }
    });
  });
};
