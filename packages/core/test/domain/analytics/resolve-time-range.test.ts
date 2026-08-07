import { constant } from "@voidhash/lib/lang";
import { describe, expect, it } from "vite-plus/test";
import { DateTime, Effect } from "effect";

import {
  type AnalyticsTimeRange,
  InvalidTimeRangeError,
  resolveTimeRange,
} from "../../../src/domain/analytics/Analytics.ts";

/** Builds a `Date` from an epoch-millis or ISO-string input without `new Date`. */
const dateOf = (input: number | string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(input));

/** Builds the instant of local midnight for the given calendar day (month is 1-based). */
const localDate = (year: number, month: number, day: number): Date =>
  DateTime.toDateUtc(
    DateTime.makeZonedUnsafe(
      { day, month, year },
      { adjustForTimeZone: true, timeZone: DateTime.zoneMakeLocal() },
    ),
  );

const now = (): Date => Effect.runSync(DateTime.nowAsDate);

/**
 * `resolveTimeRange` reads the wall clock rather than Effect's `Clock`, so
 * `TestClock` cannot pin "now" (it only moves the Effect clock, not the system
 * time). Instead we sandwich each call between two truncated-second snapshots
 * and assert the resolved `end` lands inside that `[before, after]` window.
 * Start boundaries are then derived from the *resolved* `end` so the assertions
 * stay deterministic even across a second-tick during the test.
 */
const truncateToSecond = (date: Date): Date => dateOf(Math.floor(date.getTime() / 1000) * 1000);

const preset = (
  p: Exclude<AnalyticsTimeRange, { preset: "custom" }>["preset"],
): AnalyticsTimeRange => ({ preset: p });

const customRange = (start: Date, end: Date): AnalyticsTimeRange => ({
  end,
  preset: "custom",
  start,
});

const run = (timeRange: AnalyticsTimeRange) => Effect.runSync(resolveTimeRange(timeRange));

const DAY_MS = 24 * 60 * 60 * 1000;

describe("resolveTimeRange — presets (relative windows)", () => {
  it.each(
    constant([
      { days: 7, label: "last_7d" },
      { days: 30, label: "last_30d" },
      { days: 90, label: "last_90d" },
      { days: 365, label: "last_365d" },
    ]),
  )("'$label' spans exactly $days days ending at now", ({ days, label }) => {
    const before = truncateToSecond(now());
    const { end, start } = run(preset(label));
    const after = truncateToSecond(now());

    // end is the resolved "now", inside the sandwich window.
    expect(end.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(after.getTime());
    // start is precisely `days` * 24h before that same resolved end.
    expect(end.getTime() - start.getTime()).toBe(days * DAY_MS);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe("resolveTimeRange — presets (calendar boundaries)", () => {
  it("'today' starts at local midnight of the resolved end's day", () => {
    const before = truncateToSecond(now());
    const { end, start } = run(preset("today"));
    const after = truncateToSecond(now());

    expect(end.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(after.getTime());

    const expectedStart = localDate(end.getFullYear(), end.getMonth() + 1, end.getDate());
    expect(start.getTime()).toBe(expectedStart.getTime());
    // Local midnight: no sub-day components.
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("'mtd' starts at the first day of the resolved end's month", () => {
    const { end, start } = run(preset("mtd"));

    const expectedStart = localDate(end.getFullYear(), end.getMonth() + 1, 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it("'qtd' starts at the first day of the resolved end's quarter", () => {
    const { end, start } = run(preset("qtd"));

    const quarter = Math.floor(end.getMonth() / 3);
    const expectedStart = localDate(end.getFullYear(), quarter * 3 + 1, 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    // Quarter-start month is always one of Jan/Apr/Jul/Oct (0,3,6,9).
    expect(start.getMonth() % 3).toBe(0);
    expect(start.getDate()).toBe(1);
  });

  it("'ytd' starts at January 1st of the resolved end's year", () => {
    const { end, start } = run(preset("ytd"));

    const expectedStart = localDate(end.getFullYear(), 1, 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });
});

describe("resolveTimeRange — custom window", () => {
  it("passes through a valid start < end, truncated to second precision", () => {
    const start = dateOf("2026-01-01T00:00:00.123Z");
    const end = dateOf("2026-02-01T12:30:45.987Z");

    const result = run(customRange(start, end));

    expect(result.start.getTime()).toBe(truncateToSecond(start).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(end).getTime());
    // Sub-second milliseconds are floored away.
    expect(result.start.getMilliseconds()).toBe(0);
    expect(result.end.getMilliseconds()).toBe(0);
  });

  it("ignores the wall clock entirely — custom end is the input end, not 'now'", () => {
    // A historical window far in the past: the resolved end must be the input
    // end, proving the resolver does not substitute the current time here.
    const start = dateOf("2020-03-01T00:00:00.000Z");
    const end = dateOf("2020-03-31T23:59:59.000Z");

    const result = run(customRange(start, end));

    expect(result.end.getTime()).toBe(end.getTime());
    expect(result.start.getTime()).toBe(start.getTime());
    expect(result.end.getTime()).toBeLessThan(now().getTime());
  });

  it("accepts a window whose only difference is sub-second (start < end after raw compare)", () => {
    // start and end compare as start < end on the raw Date objects even though
    // they collapse to the same truncated second; the validation uses the raw
    // values so this is accepted (no rejection on equal-after-truncation).
    const start = dateOf("2026-01-01T00:00:00.100Z");
    const end = dateOf("2026-01-01T00:00:00.900Z");

    const result = run(customRange(start, end));

    expect(result.start.getTime()).toBe(truncateToSecond(start).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(end).getTime());
    expect(result.start.getTime()).toBe(result.end.getTime());
  });

  it("rejects start > end with a typed InvalidTimeRangeError", () => {
    const start = dateOf("2026-02-01T00:00:00.000Z");
    const end = dateOf("2026-01-01T00:00:00.000Z");

    // `Effect.flip` moves the typed error into the success channel for a direct
    // instanceof assertion (mirrors SecretBox.test.ts).
    const error = Effect.runSync(resolveTimeRange(customRange(start, end)).pipe(Effect.flip));

    expect(error).toBeInstanceOf(InvalidTimeRangeError);
    expect(error.message).toBe("start must be before end");
  });

  it("accepts equal start === end (boundary: start > end is false)", () => {
    // The guard is strictly `start > end`, so an identical instant is allowed.
    const instant = dateOf("2026-05-15T08:00:00.000Z");

    const result = run(customRange(dateOf(instant.getTime()), dateOf(instant.getTime())));

    expect(result.start.getTime()).toBe(truncateToSecond(instant).getTime());
    expect(result.end.getTime()).toBe(truncateToSecond(instant).getTime());
  });
});

describe("resolveTimeRange — second-precision invariant", () => {
  it("every preset result is truncated to whole seconds (no milliseconds)", () => {
    const presets = constant([
      "today",
      "last_7d",
      "last_30d",
      "last_90d",
      "last_365d",
      "mtd",
      "qtd",
      "ytd",
    ]);

    for (const p of presets) {
      const { end, start } = run(preset(p));
      expect(end.getMilliseconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    }
  });
});
