import { FeedbackService } from "@voidhash/core/services";
import { FeedbackRpcsDef, RpcFeedbackServiceError } from "@voidhash/rpc";
import { Effect } from "effect";

export const FeedbackRpcsLive = FeedbackRpcsDef.toLayer(
  Effect.gen(function* FeedbackRpcsLive() {
    const feedbackService = yield* FeedbackService;
    return {
      SubmitFeedback: (payload) =>
        feedbackService
          .submit({
            topic: payload.topic,
            sentiment: payload.sentiment ?? null,
            message: payload.message,
            organizationId: payload.organizationId ?? null,
            projectId: payload.projectId ?? null,
            pathname: payload.pathname ?? null,
            userAgent: payload.userAgent ?? null,
          })
          .pipe(
            Effect.catchTags({
              FeedbackServiceError: (error) =>
                Effect.fail(new RpcFeedbackServiceError({ message: error.message })),
            }),
          ),
    };
  }),
);
