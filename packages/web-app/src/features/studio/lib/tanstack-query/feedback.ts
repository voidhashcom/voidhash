import type { FeedbackTopicValue } from "@voidhash/lib";

import { VoidhashRpc, eq } from "../effect-query";

/** Variables accepted by the feedback submission mutation. */
export interface SubmitFeedbackVariables {
  readonly topic: FeedbackTopicValue;
  readonly message: string;
  readonly sentiment?: number;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly pathname?: string;
  readonly userAgent?: string;
}

export const submitFeedbackOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: SubmitFeedbackVariables) =>
      VoidhashRpc.request((rpc) => rpc.SubmitFeedback(variables)),
    mutationKey: ["submitFeedback"],
  });
