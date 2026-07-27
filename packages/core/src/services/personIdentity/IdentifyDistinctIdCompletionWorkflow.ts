import { Context, type Effect } from "effect";

import type { PersonOriginValue } from "@voidhash/db";

/**
 * Payload for the asynchronous identity-migration completion job, started after
 * the synchronous `identifyDistinctId` write commits.
 */
export interface IdentifyDistinctIdCompletionInput {
  readonly distinctId: string;
  readonly eventTimestamp: string;
  readonly jobId: string;
  readonly origin: PersonOriginValue;
  readonly previousDistinctId: string;
  readonly projectId: string;
  readonly requestedAt: string;
  readonly targetPersonId: string;
}

/**
 * Abstract completion-job workflow. `dispatch` schedules the asynchronous
 * identity migration fire-and-forget; the concrete adapter (a Cloudflare
 * Workflow) is wired at the application root, so `packages/core` carries no
 * infrastructure dependency.
 */
export class IdentifyDistinctIdCompletionWorkflow extends Context.Service<
  IdentifyDistinctIdCompletionWorkflow,
  {
    readonly dispatch: (input: IdentifyDistinctIdCompletionInput) => Effect.Effect<void>;
  }
>()("IdentifyDistinctIdCompletionWorkflow") {}
