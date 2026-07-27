import {
  defineWorkflow,
  type WorkflowDefinition,
  type WorkflowExecutionResult,
  type WorkflowHandlerContext,
  WorkflowRunner,
  WorkflowRunnerError,
} from "@voidhash/platform/Workflow";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import type { PgPlatformConfig } from "../src/Postgres.ts";
import { PgWorkflowRunnerLive } from "../src/Workflow.ts";

const config: PgPlatformConfig = {
  host: process.env.PLATFORM_NODE_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_NODE_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_NODE_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_NODE_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_NODE_PG_PASSWORD ?? "password"),
};

const runnerLayer = () => Layer.merge(PgWorkflowRunnerLive(config), NodePlatformRuntimeLive);
const describePg = process.env.PLATFORM_NODE_PG_TEST === "1" ? describe : describe.skip;

const awaitResult = <
  Name extends string,
  Payload extends Schema.Struct.Fields,
  Success extends Schema.Top,
>(
  runner: WorkflowRunner["Service"],
  workflow: WorkflowDefinition<Name, Payload, Success>,
  executionId: string,
  predicate: (result: WorkflowExecutionResult<Success["Type"]>) => boolean,
) =>
  Effect.gen(function* () {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const result = yield* runner.poll(workflow, executionId);
      if (Option.isSome(result) && predicate(result.value)) {
        return result.value;
      }
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.die("workflow result timed out");
  });

describePg("Postgres workflow runner", () => {
  it("replays completed steps and resumes a durable clock after restart", async () => {
    const name = `workflow-restart-${crypto.randomUUID()}`;
    const workflow = defineWorkflow({
      name,
      payload: { value: Schema.Number },
      success: Schema.Number,
      idempotencyKey: ({ value }) => String(value),
    });
    let firstStepRuns = 0;
    let secondStepRuns = 0;
    const wakeAt = new Date(Date.now() + 300);
    const handler = (payload: { readonly value: number }, context: WorkflowHandlerContext) =>
      Effect.gen(function* () {
        const first = yield* context.step({
          name: "first",
          success: Schema.Number,
          execute: Effect.sync(() => {
            firstStepRuns += 1;
            return payload.value + 1;
          }),
        });
        yield* context.sleepUntil("restart-clock", wakeAt);
        return yield* context.step({
          name: "second",
          success: Schema.Number,
          execute: Effect.sync(() => {
            secondStepRuns += 1;
            return first + 1;
          }),
        });
      });

    const executionId = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(workflow, handler);
          const id = yield* runner.dispatch(workflow, { value: 40 });
          yield* awaitResult(
            runner,
            workflow,
            id,
            (result) => result.status === "suspended",
          );
          return id;
        }).pipe(Effect.provide(runnerLayer())),
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, 350));

    const value = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(workflow, handler);
          return yield* runner.execute(workflow, { value: 40 });
        }).pipe(Effect.provide(runnerLayer())),
      ),
    );

    expect(executionId).toBeTypeOf("string");
    expect(value).toBe(42);
    expect(firstStepRuns).toBe(1);
    expect(secondStepRuns).toBe(1);
  });

  it("deduplicates concurrent executions and reuses the persisted result", async () => {
    const workflow = defineWorkflow({
      name: `workflow-concurrent-${crypto.randomUUID()}`,
      payload: { value: Schema.Number },
      success: Schema.Number,
      idempotencyKey: ({ value }) => String(value),
    });
    let runs = 0;

    const execute = () =>
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(workflow, (payload, context) =>
            context.step({
              name: "only-step",
              success: Schema.Number,
              execute: Effect.sync(() => {
                runs += 1;
                return payload.value * 2;
              }).pipe(Effect.andThen(Effect.sleep("30 millis")), Effect.as(payload.value * 2)),
            }),
          );
          return yield* runner.execute(workflow, { value: 21 });
        }).pipe(Effect.provide(runnerLayer())),
      );

    const values = await Effect.runPromise(
      Effect.all([execute(), execute()], { concurrency: "unbounded" }),
    );

    expect(values).toEqual([42, 42]);
    expect(runs).toBe(1);
  });

  it("persists a failed step through the stable workflow error channel", async () => {
    const workflow = defineWorkflow({
      name: `workflow-failure-${crypto.randomUUID()}`,
      payload: { value: Schema.Number },
      success: Schema.Number,
      idempotencyKey: ({ value }) => String(value),
    });

    const error = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(workflow, (_payload, context) =>
            context.step({
              name: "failing-step",
              success: Schema.Number,
              execute: Effect.fail("expected failure"),
            }),
          );
          return yield* runner.execute(workflow, { value: 1 }).pipe(Effect.flip);
        }).pipe(Effect.provide(runnerLayer())),
      ),
    );

    expect(error).toBeInstanceOf(WorkflowRunnerError);
    expect(error.operation).toBe("step:failing-step");
  });

  it("persists interruption of a suspended execution", async () => {
    const workflow = defineWorkflow({
      name: `workflow-interrupt-${crypto.randomUUID()}`,
      payload: { value: Schema.Number },
      success: Schema.Number,
      idempotencyKey: ({ value }) => String(value),
    });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runner = yield* WorkflowRunner;
          yield* runner.register(workflow, (payload, context) =>
            context
              .sleepUntil("long-clock", new Date(Date.now() + 60_000))
              .pipe(Effect.as(payload.value)),
          );
          const executionId = yield* runner.dispatch(workflow, { value: 1 });
          yield* awaitResult(
            runner,
            workflow,
            executionId,
            (state) => state.status === "suspended",
          );
          yield* runner.interrupt(workflow, executionId);
          return yield* awaitResult(
            runner,
            workflow,
            executionId,
            (state) => state.status === "interrupted",
          );
        }).pipe(Effect.provide(runnerLayer())),
      ),
    );

    expect(result).toEqual({ status: "interrupted" });
  });
});
