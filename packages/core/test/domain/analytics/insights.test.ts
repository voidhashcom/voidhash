import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import {
  type AnalyticsInsightQuery,
  BUILT_IN_INSIGHTS,
  ensureNoBreakdowns,
  getBuiltInInsight,
  UnknownInsightError,
  UnsupportedAnalyticsBreakdownError,
} from "../../../src/domain/analytics/Analytics.ts";

/** A fresh breakdown entry for `AnalyticsInsightQuery["breakdowns"]`. */
const breakdown = (
  overrides: Partial<{ field: string; limit?: number; order?: "asc" | "desc" }> = {},
): NonNullable<AnalyticsInsightQuery["breakdowns"]>[number] => ({
  field: "product.id",
  ...overrides,
});

describe("getBuiltInInsight", () => {
  it("returns the definition for a known insightId", async () => {
    const insight = await Effect.runPromise(getBuiltInInsight("builtin/revenue"));
    expect(insight.id).toBe("builtin/revenue");
    expect(insight.resultKind).toBe("metric");
  });

  it("resolves every BUILT_IN_INSIGHTS entry by its own id", async () => {
    for (const expected of BUILT_IN_INSIGHTS) {
      const resolved = await Effect.runPromise(getBuiltInInsight(expected.id));
      // The registry must return the same definition object it was seeded with.
      expect(resolved).toBe(expected);
    }
  });

  it("fails with a typed UnknownInsightError for an unknown insightId", async () => {
    const error = await Effect.runPromise(
      getBuiltInInsight("builtin/does-not-exist").pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(UnknownInsightError);
    expect(error.insightId).toBe("builtin/does-not-exist");
    expect(error.message).toContain("builtin/does-not-exist");
  });

  it("fails with UnknownInsightError for an empty insightId", async () => {
    const error = await Effect.runPromise(getBuiltInInsight("").pipe(Effect.flip));
    expect(error).toBeInstanceOf(UnknownInsightError);
    expect(error.insightId).toBe("");
  });
});

describe("ensureNoBreakdowns", () => {
  it("succeeds when breakdowns is undefined", async () => {
    await expect(Effect.runPromise(ensureNoBreakdowns(undefined))).resolves.toBeUndefined();
  });

  it("succeeds when breakdowns is an empty array", async () => {
    await expect(Effect.runPromise(ensureNoBreakdowns([]))).resolves.toBeUndefined();
  });

  it("fails with a typed UnsupportedAnalyticsBreakdownError for a non-empty array", async () => {
    const error = await Effect.runPromise(ensureNoBreakdowns([breakdown()]).pipe(Effect.flip));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsBreakdownError);
    expect(error.field).toBe("product.id");
  });

  it("reports the first breakdown's field on the error", async () => {
    const error = await Effect.runPromise(
      ensureNoBreakdowns([breakdown({ field: "subscription.status" }), breakdown()]).pipe(
        Effect.flip,
      ),
    );
    expect(error).toBeInstanceOf(UnsupportedAnalyticsBreakdownError);
    expect(error.field).toBe("subscription.status");
  });
});
