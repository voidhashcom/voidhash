import type { StoredAnalyticsEvent } from "@voidhash/core/services/analytics/AnalyticsEventStore";
import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { resolvePostgresAnalyticsSeries } from "../../../src/services/analytics/postgres-series-resolver.ts";

const date = (value: string) => DateTime.toDateUtc(DateTime.makeUnsafe(value));
const timestamp = date("2026-08-01T12:00:00.000Z");

const event = (
  sequence: number,
  eventName: string,
  grossAmountUsd: number,
): StoredAnalyticsEvent => ({
  captureId: `capture-${sequence}`,
  context: {},
  distinctId: "customer-1",
  eventId: `event-${sequence}`,
  eventName,
  eventTimestamp: timestamp,
  identityMode: "full",
  organizationId: "org-1",
  personId: "person-1",
  previousDistinctId: null,
  processedAt: timestamp,
  projectId: "project-1",
  properties: { grossAmountUsd },
  requestId: `request-${sequence}`,
  requestPath: "/internal/analytics",
  schemaVersion: 1,
  sequence,
  sessionId: null,
  source: "revenue",
  sourceTopic: "revenue.trusted.v1",
  token: "internal",
});

describe("OSS PostgreSQL revenue analytics", () => {
  it("calculates net revenue from signed portable revenue events", () => {
    const series = resolvePostgresAnalyticsSeries({
      end: date("2026-08-02T00:00:00.000Z"),
      events: [event(1, "$purchase.completed", 1_000), event(2, "$purchase.refunded", -250)],
      filters: { projectIds: ["project-1"] },
      granularity: "day",
      insightId: "builtin/revenue",
      start: date("2026-08-01T00:00:00.000Z"),
    });

    expect(series).toEqual([{ timestamp: date("2026-08-01T00:00:00.000Z"), value: 7.5 }]);
  });
});
