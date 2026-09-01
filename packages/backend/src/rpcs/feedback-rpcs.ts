import { FeedbackService } from "@voidhash/core/services";
import { FeedbackRpcsDef, RpcFeedbackServiceError } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

export const FeedbackRpcsLive = FeedbackRpcsDef.toLayer(
  Effect.gen(function* FeedbackRpcsLive() {
    const feedbackService = yield* FeedbackService;
    return {
      SubmitFeedback: (payload) =>
        feedbackService
          .submit({
            topic: payload.topic,
            sentiment: Option.fromNullishOr(payload.sentiment),
            message: payload.message,
            organizationId: Option.fromNullishOr(payload.organizationId),
            projectId: Option.fromNullishOr(payload.projectId),
            pathname: Option.fromNullishOr(payload.pathname),
            userAgent: Option.fromNullishOr(payload.userAgent),
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
