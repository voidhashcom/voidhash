import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ApiActionForbiddenError, ApiEventAdmissionError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import {
  EventAdmissionPolicy,
  IngestPolicyParams,
  SetBuiltinEventAdmissionBody,
  SetCustomEventBlockedBody,
} from "../schemas/analytics.ts";

export const IngestPolicyGroup = HttpApiGroup.make("ingest_policy")
  .add(
    /**
     * Reads the project's event admission policy: every built-in entry resolved
     * against the edition's defaults, plus the custom-event blocklist.
     *
     * Accepts a user session, `x-api-key`, or a secret key; publishable keys
     * are rejected.
     */
    HttpApiEndpoint.get("getIngestPolicy", "/", {
      query: IngestPolicyParams,
      success: EventAdmissionPolicy,
      error: [ApiActionForbiddenError, ApiEventAdmissionError],
    }),
  )
  .add(
    /**
     * Turns one built-in event entry on or off. `PUT` because it is an
     * idempotent write of a single named setting; the recomputed policy comes
     * back so a caller never has to re-read it.
     *
     * Accepts a user session, `x-api-key`, or a secret key; publishable keys
     * are rejected.
     */
    HttpApiEndpoint.put("setBuiltinEventAdmission", "/builtin-events/:key", {
      params: { key: Schema.String },
      payload: SetBuiltinEventAdmissionBody,
      success: EventAdmissionPolicy,
      error: [ApiActionForbiddenError, ApiEventAdmissionError],
    }),
  )
  .add(
    /**
     * Blocks or unblocks one custom event by name. The name is URL-encoded in
     * the path; reserved (`$`-prefixed) events are rejected here and toggled
     * through the built-in list instead.
     *
     * Accepts a user session, `x-api-key`, or a secret key; publishable keys
     * are rejected.
     */
    HttpApiEndpoint.put("setCustomEventBlocked", "/custom-events/:eventName", {
      params: { eventName: Schema.String },
      payload: SetCustomEventBlockedBody,
      success: EventAdmissionPolicy,
      error: [ApiActionForbiddenError, ApiEventAdmissionError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/ingest-policy");
