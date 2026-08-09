import { Effect } from "effect";

import {
  type AnalyticsInsightQuery,
  BUILT_IN_INSIGHTS,
  ensureNoBreakdowns,
  getBuiltInInsight,
  UnknownInsightError,
  UnsupportedAnalyticsBreakdownError,
} from "../../../src/domain/analytics/Analytics.ts";
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

/** A fresh breakdown entry for `AnalyticsInsightQuery["breakdowns"]`. */
const breakdown = (
  overrides: Partial<{ field: string; limit?: number; order?: "asc" | "desc" }> = {},
): NonNullable<AnalyticsInsightQuery["breakdowns"]>[number] => ({
  field: "product.id",
  ...overrides,
});

describe("getBuiltInInsight", () => {
  it.effect("returns the definition for a known insightId", () =>
    Effect.gen(function* () {
      const insight = yield* getBuiltInInsight("builtin/revenue");
      expect(insight.id).toBe("builtin/revenue");
      expect(insight.resultKind).toBe("metric");
    }),
  );

  it.effect("resolves every BUILT_IN_INSIGHTS entry by its own id", () =>
    Effect.gen(function* () {
      for (const expected of BUILT_IN_INSIGHTS) {
        const resolved = yield* getBuiltInInsight(expected.id);
        // The registry must return the same definition object it was seeded with.
        expect(resolved).toBe(expected);
      }
    }),
  );

  it.effect("fails with a typed UnknownInsightError for an unknown insightId", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(getBuiltInInsight("builtin/does-not-exist"));
      expect(error).toBeInstanceOf(UnknownInsightError);
      expect(error.insightId).toBe("builtin/does-not-exist");
      expect(error.message).toContain("builtin/does-not-exist");
    }),
  );

  it.effect("fails with UnknownInsightError for an empty insightId", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(getBuiltInInsight(""));
      expect(error).toBeInstanceOf(UnknownInsightError);
      expect(error.insightId).toBe("");
    }),
  );
});

describe("ensureNoBreakdowns", () => {
  it.effect("succeeds when breakdowns is undefined", () =>
    Effect.gen(function* () {
      expect(yield* ensureNoBreakdowns(undefined)).toBeUndefined();
    }),
  );

  it.effect("succeeds when breakdowns is an empty array", () =>
    Effect.gen(function* () {
      expect(yield* ensureNoBreakdowns([])).toBeUndefined();
    }),
  );

  it.effect("fails with a typed UnsupportedAnalyticsBreakdownError for a non-empty array", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(ensureNoBreakdowns([breakdown()]));
      expect(error).toBeInstanceOf(UnsupportedAnalyticsBreakdownError);
      expect(error.field).toBe("product.id");
    }),
  );

  it.effect("reports the first breakdown's field on the error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        ensureNoBreakdowns([breakdown({ field: "subscription.status" }), breakdown()]),
      );
      expect(error).toBeInstanceOf(UnsupportedAnalyticsBreakdownError);
      expect(error.field).toBe("subscription.status");
    }),
  );
});
