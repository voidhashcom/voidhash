import { describe, expect, it } from "vite-plus/test";

import {
  type AnalyticsDataPoint,
  avgDataPoints,
  isReservedAnalyticsField,
  isSupportedRevenueFilterField,
  sumDataPoints,
} from "../../../src/domain/analytics/Analytics.ts";

/** Fresh data point builder — one object per use, no shared mutable state. */
const point = (
  value: number,
  timestamp = new Date("2026-01-01T00:00:00Z"),
): AnalyticsDataPoint => ({
  timestamp,
  value,
});

describe("sumDataPoints", () => {
  it("returns 0 for an empty array", () => {
    expect(sumDataPoints([])).toBe(0);
  });

  it("returns the single value for a one-element array", () => {
    expect(sumDataPoints([point(42)])).toBe(42);
  });

  it("returns the arithmetic sum for multiple data points", () => {
    expect(sumDataPoints([point(10), point(20), point(30)])).toBe(60);
  });

  it("handles negative and fractional values", () => {
    expect(sumDataPoints([point(-5), point(2.5), point(2.5)])).toBe(0);
  });
});

describe("avgDataPoints", () => {
  it("returns 0 for an empty array (no division by zero)", () => {
    expect(avgDataPoints([])).toBe(0);
  });

  it("returns the single value for a one-element array", () => {
    expect(avgDataPoints([point(42)])).toBe(42);
  });

  it("returns the mean for multiple data points", () => {
    expect(avgDataPoints([point(10), point(20), point(30)])).toBe(20);
  });

  it("can return a fractional mean", () => {
    expect(avgDataPoints([point(1), point(2)])).toBe(1.5);
  });
});

describe("isSupportedRevenueFilterField", () => {
  it.each(["project.id", "product.id", "provider.environment", "subscription.status"])(
    "returns true for the supported field %s",
    (field) => {
      expect(isSupportedRevenueFilterField(field)).toBe(true);
    },
  );

  it("returns false for an unknown field", () => {
    expect(isSupportedRevenueFilterField("foo.bar")).toBe(false);
  });

  it("returns false for a partial / prefix match (exact membership only)", () => {
    expect(isSupportedRevenueFilterField("project")).toBe(false);
    expect(isSupportedRevenueFilterField("project.id.extra")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSupportedRevenueFilterField("")).toBe(false);
  });
});

describe("isReservedAnalyticsField", () => {
  it.each(["event.name", "person.properties.email", "event.properties.url", "context.app.version"])(
    "returns true for a field with the reserved prefix in %s",
    (field) => {
      expect(isReservedAnalyticsField(field)).toBe(true);
    },
  );

  it("returns false for a non-reserved field", () => {
    expect(isReservedAnalyticsField("project.id")).toBe(false);
  });

  it("returns false when the prefix only appears mid-string (must be a prefix)", () => {
    expect(isReservedAnalyticsField("foo.event.name")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isReservedAnalyticsField("")).toBe(false);
  });
});
