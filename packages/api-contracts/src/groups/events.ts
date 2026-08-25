import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ApiActionForbiddenError, ApiAnalyticsServiceError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { AnalyticsEvent, EventListParams } from "../schemas/analytics.ts";

export const EventsGroup = HttpApiGroup.make("events")
  .add(
    /**
     * Lists recently captured analytics events, newest first, closing the loop
     * with `/i/v1/capture`: what a client writes over HTTP is now readable over
     * HTTP too. Optionally narrowed to a single `eventName`.
     *
     * Accepts a user session, `x-api-key`, or a secret key; publishable keys
     * are rejected.
     */
    HttpApiEndpoint.get("listEvents", "/", {
      query: EventListParams,
      success: paginated(AnalyticsEvent),
      error: [ApiActionForbiddenError, ApiAnalyticsServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/events");
