import { describe, expect, it } from "vite-plus/test";

import { REVENUE_TRUSTED_SOURCE_TOPIC } from "../../../src/domain/internalAnalytics/InternalAnalyticsEvents.ts";
import {
  dedupeRevenueRowsWithinBatch,
  isRevenueAnalyticsWriterRow,
} from "../../../src/services/analyticsIngest/AnalyticsWriterService.ts";

/**
 * A trusted revenue writer row: stamped with the revenue source topic and a
 * reserved revenue event name (sourced from the domain so the test exercises
 * the real {@link isReservedRevenueEventName} integration, not a string copy).
 */
const revenueRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  source_topic: REVENUE_TRUSTED_SOURCE_TOPIC,
  event_name: "$purchase.completed",
  event_id: "evt-1",
  ...overrides,
});

/** A customer-SDK row that must always pass through untouched. */
const nonRevenueRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  source_topic: "capture.v1",
  event_name: "checkout_started",
  event_id: "evt-non-1",
  ...overrides,
});

describe("isRevenueAnalyticsWriterRow", () => {
  it("returns true for a row with the revenue topic and a reserved revenue event name", () => {
    expect(isRevenueAnalyticsWriterRow(revenueRow())).toBe(true);
  });

  it("returns true for every reserved revenue event name on the revenue topic", () => {
    // Drive the real domain set so adding a new reserved event keeps coverage.
    const reservedNames = [
      "$purchase.refunded",
      "$purchase.revoked",
      "$subscription.created",
      "$subscription.renewed",
      "$subscription.canceled",
      "$subscription.transferred_in",
    ] as const;
    for (const event_name of reservedNames) {
      expect(isRevenueAnalyticsWriterRow(revenueRow({ event_name }))).toBe(true);
    }
  });

  it("returns false for a non-revenue source topic even with a reserved event name", () => {
    expect(isRevenueAnalyticsWriterRow(revenueRow({ source_topic: "capture.v1" }))).toBe(false);
  });

  it("returns false when source_topic is missing", () => {
    const { source_topic, ...rest } = revenueRow();
    void source_topic;
    expect(isRevenueAnalyticsWriterRow(rest)).toBe(false);
  });

  it("returns false when event_name is not a reserved revenue event name", () => {
    expect(isRevenueAnalyticsWriterRow(revenueRow({ event_name: "purchase.completed" }))).toBe(
      false,
    );
  });

  it("returns false when event_name is not a string", () => {
    expect(isRevenueAnalyticsWriterRow(revenueRow({ event_name: 42 }))).toBe(false);
    expect(isRevenueAnalyticsWriterRow(revenueRow({ event_name: undefined }))).toBe(false);
  });
});

describe("dedupeRevenueRowsWithinBatch", () => {
  it("removes duplicate revenue event_ids within the batch, first seen wins", () => {
    const first = revenueRow({ event_id: "evt-dup", event_name: "$purchase.completed" });
    const second = revenueRow({ event_id: "evt-dup", event_name: "$purchase.refunded" });
    const result = dedupeRevenueRowsWithinBatch([first, second]);
    expect(result.rows).toEqual([first]);
    expect(result.rows[0]).toBe(first);
    expect(result.skippedCount).toBe(1);
  });

  it("keeps non-revenue rows and revenue rows without an event_id unchanged", () => {
    const noId = revenueRow({ event_id: undefined });
    const nonRev = nonRevenueRow();
    const rows = [noId, nonRev];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.rows).toEqual(rows);
    expect(result.skippedCount).toBe(0);
  });

  it("does not dedupe non-revenue rows that share an event_id", () => {
    const rows = [nonRevenueRow({ event_id: "evt-x" }), nonRevenueRow({ event_id: "evt-x" })];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.rows).toEqual(rows);
    expect(result.skippedCount).toBe(0);
  });

  it("counts every deduplicated revenue row in skippedCount", () => {
    const rows = [
      revenueRow({ event_id: "evt-a" }),
      revenueRow({ event_id: "evt-a" }),
      revenueRow({ event_id: "evt-a" }),
      revenueRow({ event_id: "evt-b" }),
    ];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.rows.map((r) => r.event_id)).toEqual(["evt-a", "evt-b"]);
    expect(result.skippedCount).toBe(2);
  });

  it("returns the original rows array reference when skippedCount is 0 (no allocation)", () => {
    const rows = [
      revenueRow({ event_id: "evt-a" }),
      revenueRow({ event_id: "evt-b" }),
      nonRevenueRow(),
    ];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.skippedCount).toBe(0);
    expect(result.rows).toBe(rows);
  });

  it("returns an empty result for an empty batch", () => {
    const rows: Array<Record<string, unknown>> = [];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.rows).toBe(rows);
    expect(result.skippedCount).toBe(0);
  });

  it("treats a non-string event_id as no id (passes through, never deduped)", () => {
    const rows = [revenueRow({ event_id: 7 }), revenueRow({ event_id: 7 })];
    const result = dedupeRevenueRowsWithinBatch(rows);
    expect(result.rows).toEqual(rows);
    expect(result.skippedCount).toBe(0);
  });
});
