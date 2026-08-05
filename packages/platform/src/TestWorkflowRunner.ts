import { Effect, Option } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import type * as Workflow from "./Workflow.ts";
import type { WorkflowExecutionResult, WorkflowRunnerShape } from "./WorkflowRunner.ts";

/** One workflow dispatch captured by a recording test runner. */
export interface Dispatch {
  readonly workflow: Workflow.Any;
  readonly payload: unknown;
  readonly executionId: string;
}

/** Recording runner returned by {@link make}. */
export interface TestWorkflowRunner extends WorkflowRunnerShape {
  readonly dispatches: Array<Dispatch>;
}

/** Creates a dependency-free runner that records workflow dispatches. */
export const make = (): TestWorkflowRunner => {
  const dispatches: Array<Dispatch> = [];

  const dispatch: WorkflowRunnerShape["dispatch"] = (workflow, payload) => {
    const executionId = workflow.idempotencyKey(payload);
    dispatches.push({ executionId, payload, workflow: workflow as Workflow.Any });
    return Effect.succeed(executionId) as Effect.Effect<string, never, PlatformRuntime>;
  };

  return {
    dispatches,
    register: () => Effect.void,
    dispatch,
    execute: (workflow, payload) =>
      dispatch(workflow, payload).pipe(
        Effect.andThen(Effect.die(new Error("TestWorkflowRunner does not execute workflows"))),
      ) as never,
    poll: () => Effect.succeed(Option.none<WorkflowExecutionResult<never>>()) as never,
    resume: () => Effect.void,
    interrupt: () => Effect.void,
  };
};
