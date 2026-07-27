import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import {
  type AnalyticsTimeRange,
  InvalidTimeRangeError,
  resolveTimeRange,
} from "../../../src/domain/analytics/Analytics.ts";

/**
 * `resolveTimeRange` reads the wall clock via `new Date()` rather than Effect's
 * `Clock`, so `TestClock` cannot pin "now" (it only moves the Effect clock, not
 * `Date.now`). Instead we sandwich each call between two truncated-second
 * snapshots and assert the resolved `end` lands inside that `[before, after]`
 * window. Start boundaries are then derived from the *resolved* `end` so the
 * assertions stay deterministic even across a second-tick during the test.
 */
const truncateToSecond = (date: Date): Date => new Date(Math.floor(date.getTime() / 1000) * 1000);

const preset = (
  p: Exclude<AnalyticsTimeRange, { preset: "custom" }>["preset"],
): AnalyticsTimeRange => ({ preset: p });

const customRange = (start: Date, end: Date): AnalyticsTimeRange => ({
  end,
  preset: "custom",
  start,
});

const run = (timeRange: AnalyticsTimeRange) => Effect.runPromise(resolveTimeRange(timeRange));

const DAY_MS = 24 * 60 * 60 * 1000;

describe("resolveTimeRange — presets (relative windows)", () => {
  it.each([
    { days: 7, label: "last_7d" },
    { days: 30, label: "last_30d" },
    { days: 90, label: "last_90d" },
    { days: 365, label: "last_365d" },
  ] as const)("'$label' spans exactly $days days ending at now", async ({ days, label }) => {
    const before = truncateToSecond(new Date());
    const { end, start } = await run(preset(label));
    const after = truncateToSecond(new Date());

    // end is the resolved "now", inside the sandwich window.
    expect(end.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(after.getTime());
    // start is precisely `days` * 24h before that same resolved end.
    expect(end.getTime() - start.getTime()).toBe(days * DAY_MS);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe("resolveTimeRange — presets (calendar boundaries)", () => {
  it("'today' starts at local midnight of the resolved end's day", async () => {
    const before = truncateToSecond(new Date());
    const { end, start } = await run(preset("today"));
    const after = truncateToSecond(new Date());

    expect(end.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(after.getTime());

    const expectedStart = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    expect(start.getTime()).toBe(expectedStart.getTime());
    // Local midnight: no sub-day components.
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("'mtd' starts at the first day of the resolved end's month", async () => {
    const { end, start } = await run(preset("mtd"));

    const expectedStart = new Date(end.getFullYear(), end.getMonth(), 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it("'qtd' starts at the first day of the resolved end's quarter", async () => {
    const { end, start } = await run(preset("qtd"));

    const quarter = Math.floor(end.getMonth() / 3);
    const expectedStart = new Date(end.getFullYear(), quarter * 3, 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    // Quarter-start month is always one of Jan/Apr/Jul/Oct (0,3,6,9).
    expect(start.getMonth() % 3).toBe(0);
    expect(start.getDate()).toBe(1);
  });

  it("'ytd' starts at January 1st of the resolved end's year", async () => {
    const { end, start } = await run(preset("ytd"));

    const expectedStart = new Date(end.getFullYear(), 0, 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });
});

describe("resolveTimeRange — custom window", () => {
  it("passes through a valid start < end, truncated to second precision", async () => {
    const start = new Date("2026-01-01T00:00:00.123Z");
    const end = new Date("2026-02-01T12:30:45.987Z");

    const result = await run(customRange(start, end));

    expect(result.start.getTime()).toBe(truncateToSecond(start).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(end).getTime());
    // Sub-second milliseconds are floored away.
    expect(result.start.getMilliseconds()).toBe(0);
    expect(result.end.getMilliseconds()).toBe(0);
  });

  it("ignores the wall clock entirely — custom end is the input end, not 'now'", async () => {
    // A historical window far in the past: the resolved end must be the input
    // end, proving the resolver does not substitute the current time here.
    const start = new Date("2020-03-01T00:00:00.000Z");
    const end = new Date("2020-03-31T23:59:59.000Z");

    const result = await run(customRange(start, end));

    expect(result.end.getTime()).toBe(end.getTime());
    expect(result.start.getTime()).toBe(start.getTime());
    expect(result.end.getTime()).toBeLessThan(Date.now());
  });

  it("accepts a window whose only difference is sub-second (start < end after raw compare)", async () => {
    // start and end compare as start < end on the raw Date objects even though
    // they collapse to the same truncated second; the validation uses the raw
    // values so this is accepted (no rejection on equal-after-truncation).
    const start = new Date("2026-01-01T00:00:00.100Z");
    const end = new Date("2026-01-01T00:00:00.900Z");

    const result = await run(customRange(start, end));

    expect(result.start.getTime()).toBe(truncateToSecond(start).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(end).getTime());
    expect(result.start.getTime()).toBe(result.end.getTime());
  });

  it("rejects start > end with a typed InvalidTimeRangeError", async () => {
    const start = new Date("2026-02-01T00:00:00.000Z");
    const end = new Date("2026-01-01T00:00:00.000Z");

    // `Effect.flip` moves the typed error into the success channel for a direct
    // instanceof assertion (mirrors SecretBox.test.ts).
    const error = await Effect.runPromise(
      resolveTimeRange(customRange(start, end)).pipe(Effect.flip),
    );

    expect(error).toBeInstanceOf(InvalidTimeRangeError);
    expect(error.message).toBe("start must be before end");
  });

  it("accepts equal start === end (boundary: start > end is false)", async () => {
    // The guard is strictly `start > end`, so an identical instant is allowed.
    const instant = new Date("2026-05-15T08:00:00.000Z");

    const result = await run(customRange(new Date(instant), new Date(instant)));

    expect(result.start.getTime()).toBe(truncateToSecond(instant).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(instant).getTime());
  });
});

describe("resolveTimeRange — second-precision invariant", () => {
  it("every preset result is truncated to whole seconds (no milliseconds)", async () => {
    const presets = [
      "today",
      "last_7d",
      "last_30d",
      "last_90d",
      "last_365d",
      "mtd",
      "qtd",
      "ytd",
    ] as const;

    for (const p of presets) {
      const { end, start } = await run(preset(p));
      expect(end.getMilliseconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    }
  });
});
