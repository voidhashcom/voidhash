import { Effect, Option } from "effect";

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
    dispatches.push({ executionId, payload, workflow });
    return Effect.succeed(executionId);
  };

  return {
    dispatches,
    register: () => Effect.void,
    dispatch,
    execute: (workflow, payload) =>
      dispatch(workflow, payload).pipe(
        Effect.andThen(Effect.die(new Error("TestWorkflowRunner does not execute workflows"))),
      ),
    poll: () => Effect.succeed(Option.none<WorkflowExecutionResult<never>>()),
    resume: () => Effect.void,
    interrupt: () => Effect.void,
  };
};
