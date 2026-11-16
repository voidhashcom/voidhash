import type { Analytics } from "../analytics";
import { readJsonObject, requireString, sendJson } from "../http";
import type { RouteHandler } from "../server";

const properties = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * `POST /v1/events` — forwards a client-supplied analytics event.
 *
 * Answers `202` as soon as the event is queued: capture is fire-and-forget, so
 * a slow or unreachable ingest never becomes the client's problem.
 */
export const createCaptureEventRoute = (options: {
  readonly analytics: Analytics;
}): RouteHandler => {
  const { analytics } = options;

  return async (request, response) => {
    const body = await readJsonObject(request);

    analytics.capture({
      distinctId: requireString(body.distinctId, "distinct_id_required"),
      event: requireString(body.event, "event_required"),
      properties: properties(body.properties),
      timestamp: new Date(),
    });

    sendJson(response, 202, { status: "accepted" });
  };
};
