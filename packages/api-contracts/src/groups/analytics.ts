import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiAnalyticsServiceError,
  ApiInvalidMetricError,
  ApiInvalidTimeRangeError,
  ApiUnknownInsightError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { QueryInsightsBody, QueryInsightsResult } from "../schemas/analytics.ts";

export const AnalyticsGroup = HttpApiGroup.make("analytics")
  .add(
    /**
     * Runs a batch of built-in insights over the resolved project's events.
     *
     * `POST` rather than `GET` because the filter tree and time range routinely
     * exceed what a URL can carry. Authorization is a project-level check on the
     * resolved project and the query is confined to it, so a project-scoped
     * secret key can never read a sibling project.
     *
     * Accepts a user session, `x-api-key`, or a secret key; publishable keys
     * are rejected.
     */
    HttpApiEndpoint.post("queryInsights", "/queries/insights", {
      payload: QueryInsightsBody,
      success: QueryInsightsResult,
      error: [
        ApiActionForbiddenError,
        ApiAnalyticsServiceError,
        ApiInvalidMetricError,
        ApiInvalidTimeRangeError,
        ApiUnknownInsightError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/analytics");
