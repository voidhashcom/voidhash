import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcFeedbackServiceError } from "../errors/Feedback.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** Result of a successful submission — the id of the stored feedback row. */
export const SubmitFeedbackResult = Schema.Struct({
  id: Schema.String,
});

/**
 * Customer-facing feedback RPC, gated by {@link AuthMiddleware} (any
 * authenticated user). The submitter identity is derived server-side from the
 * session; the client only supplies the topic/sentiment/message plus the
 * org/project/page context it currently sits on.
 */
export class FeedbackRpcsDef extends RpcGroup.make(
  Rpc.make("SubmitFeedback", {
    error: Schema.Union([RpcFeedbackServiceError]),
    payload: {
      // A `FeedbackTopic` product-area slug (see `@voidhash/lib`). Left as a
      // free string on the wire — the studio topic select is the source of valid
      // values, and the set evolves with the product — so the rpc contract does
      // not have to be kept in lockstep. `FeedbackService` truncates to the
      // column limit before persisting.
      topic: Schema.String,
      /** Ordinal 1–4 sentiment (`FeedbackSentiment`); omitted when not picked. */
      sentiment: Schema.optional(Schema.Number),
      message: Schema.String,
      organizationId: Schema.optional(Schema.String),
      projectId: Schema.optional(Schema.String),
      pathname: Schema.optional(Schema.String),
      userAgent: Schema.optional(Schema.String),
    },
    success: SubmitFeedbackResult,
  }),
).middleware(AuthMiddleware) {}
