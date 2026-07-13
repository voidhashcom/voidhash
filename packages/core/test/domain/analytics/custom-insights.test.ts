import { CustomAnalyticsInsightQuery } from "@voidhash/rpc";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { InvalidAnalyticsQueryError } from "../../../src/domain/analytics/Analytics.ts";
import {
  alignTrendsComparisonPoints,
  applyTrendsPresentation,
  buildFunnelStepResults,
  buildLifecycleSeries,
  buildPathsLinkResults,
  buildRetentionCohortResults,
  buildStickinessBuckets,
  buildTrendsFormulaSeries,
  countStickinessIntervals,
  fillTrendsSeriesPoints,
  resolveTrendsComparisonTimeRange,
  validateExecutableFunnelsDefinition,
  validateExecutableLifecycleDefinition,
  validateExecutablePathsDefinition,
  validateExecutableRetentionDefinition,
  validateExecutableStickinessDefinition,
  validateExecutableTrendsDefinition,
} from "../../../src/services/analytics/CustomAnalyticsService.ts";

const eventSeries = {
  aggregation: "unique_users" as const,
  eventNames: ["$screen"] as const,
  key: "A",
};

const timeRange = { preset: "last_7d" as const };

const fixtures = [
  {
    comparison: "previous_period",
    display: "line",
    granularity: "day",
    kind: "trends",
    series: [eventSeries],
    timeRange,
  },
  {
    conversionWindowSeconds: 86_400,
    kind: "funnels",
    order: "sequential",
    steps: [
      { eventNames: ["paywall_viewed"], key: "A" },
      { eventNames: ["purchase_completed"], key: "B" },
    ],
    timeRange,
  },
  {
    kind: "retention",
    period: "week",
    returning: { ...eventSeries, eventNames: ["session_started"], key: "B" },
    start: eventSeries,
    timeRange,
  },
  {
    eventNames: ["$screen", "button_pressed"],
    kind: "paths",
    maxDepth: 8,
    timeRange,
  },
  {
    interval: "day",
    kind: "stickiness",
    series: [eventSeries],
    timeRange,
  },
  {
    granularity: "week",
    kind: "lifecycle",
    series: eventSeries,
    timeRange,
  },
] as const;

describe("CustomAnalyticsInsightQuery", () => {
  it("decodes every supported insight family", async () => {
    for (const fixture of fixtures) {
      const decoded = await Effect.runPromise(
        Schema.decodeUnknownEffect(CustomAnalyticsInsightQuery)(fixture),
      );
      expect(decoded.kind).toBe(fixture.kind);
    }
  });

  it("rejects a trends definition without a series", async () => {
    const error = await Effect.runPromise(
      Schema.decodeUnknownEffect(CustomAnalyticsInsightQuery)({
        display: "line",
        granularity: "day",
        kind: "trends",
        series: [],
        timeRange,
      }).pipe(Effect.flip),
    );
    expect(error).toBeDefined();
  });
});

describe("validateExecutableTrendsDefinition", () => {
  it("accepts the first live trends subset", async () => {
    const definition = await Effect.runPromise(validateExecutableTrendsDefinition(fixtures[0]));
    expect(definition.kind).toBe("trends");
    expect(definition.comparison).toBe("previous_period");
    expect(definition.series[0].aggregation).toBe("unique_users");
  });

  it("fails with a typed error for a future query family", async () => {
    const error = await Effect.runPromise(
      validateExecutableTrendsDefinition(fixtures[1]).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect(error.message).toContain("funnels");
  });

  it("accepts custom property filters and breakdowns", async () => {
    const definition = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        breakdown: { field: "event.properties.country", limit: 8 },
        series: [
          {
            ...eventSeries,
            filters: {
              field: "event.properties.plan",
              op: "eq",
              type: "predicate",
              value: "pro",
            },
          },
        ],
      }),
    );
    expect(definition.breakdown?.field).toBe("event.properties.country");
    expect(definition.series[0].filters).toBeDefined();
  });

  it("rejects fields that cannot be lowered safely", async () => {
    const error = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        breakdown: { field: "context.device.secret" },
      }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect(error.message).toContain("Unsupported custom analytics field");
  });

  it("resolves and aligns an equal previous-period window", () => {
    const current = {
      end: new Date("2026-07-13T12:00:00.000Z"),
      start: new Date("2026-07-06T12:00:00.000Z"),
    };
    const comparison = resolveTrendsComparisonTimeRange("previous_period", current);

    expect(comparison).toEqual({
      end: new Date("2026-07-06T11:59:59.000Z"),
      start: new Date("2026-06-29T12:00:00.000Z"),
    });
    expect(
      alignTrendsComparisonPoints(
        [{ timestamp: new Date("2026-06-30T00:00:00.000Z"), value: 12 }],
        current,
        comparison,
        "day",
      ),
    ).toEqual([{ timestamp: new Date("2026-07-07T00:00:00.000Z"), value: 12 }]);
  });

  it("clamps leap day when resolving a previous-year comparison", () => {
    const comparison = resolveTrendsComparisonTimeRange("previous_year", {
      end: new Date("2024-03-01T08:30:00.000Z"),
      start: new Date("2024-02-29T08:30:00.000Z"),
    });

    expect(comparison).toEqual({
      end: new Date("2023-03-01T08:30:00.000Z"),
      start: new Date("2023-02-28T08:30:00.000Z"),
    });
  });

  it("aligns weekly comparisons by bucket position and fills sparse buckets", () => {
    const current = {
      end: new Date("2026-07-31T00:00:00.000Z"),
      start: new Date("2026-07-01T00:00:00.000Z"),
    };
    const comparison = resolveTrendsComparisonTimeRange("previous_period", current);
    expect(
      alignTrendsComparisonPoints(
        [{ timestamp: new Date("2026-06-08T00:00:00.000Z"), value: 7 }],
        current,
        comparison,
        "week",
      ),
    ).toEqual([{ timestamp: new Date("2026-07-06T00:00:00.000Z"), value: 7 }]);

    expect(
      fillTrendsSeriesPoints(
        [{ timestamp: new Date("2026-07-07T00:00:00.000Z"), value: 3 }],
        {
          end: new Date("2026-07-08T12:00:00.000Z"),
          start: new Date("2026-07-06T12:00:00.000Z"),
        },
        "day",
      ),
    ).toEqual([
      { timestamp: new Date("2026-07-06T00:00:00.000Z"), value: 0 },
      { timestamp: new Date("2026-07-07T00:00:00.000Z"), value: 3 },
      { timestamp: new Date("2026-07-08T00:00:00.000Z"), value: 0 },
    ]);
  });

  it("smooths, accumulates, and removes weekend buckets in presentation order", () => {
    const points = [
      { timestamp: new Date("2026-07-10T00:00:00.000Z"), value: 2 },
      { timestamp: new Date("2026-07-11T00:00:00.000Z"), value: 4 },
      { timestamp: new Date("2026-07-12T00:00:00.000Z"), value: 6 },
      { timestamp: new Date("2026-07-13T00:00:00.000Z"), value: 8 },
    ];

    expect(
      applyTrendsPresentation(points, {
        cumulative: true,
        hideWeekends: true,
        smoothingWindow: 2,
      }),
    ).toEqual([
      { timestamp: new Date("2026-07-10T00:00:00.000Z"), value: 2 },
      { timestamp: new Date("2026-07-13T00:00:00.000Z"), value: 17 },
    ]);
  });

  it("rejects time-series presentation options on incompatible Trends definitions", async () => {
    const smoothingError = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        granularity: "week",
        smoothingWindow: 7,
      }).pipe(Effect.flip),
    );
    expect(smoothingError.message).toContain("whole-day window");

    const numberError = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        cumulative: true,
        display: "number",
      }).pipe(Effect.flip),
    );
    expect(numberError.message).toContain("do not support time-series");
  });

  it("validates formula syntax and series references", async () => {
    const definition = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        formulas: [{ expression: "(A + 2) ** 2", key: "calculated" }],
      }),
    );
    expect(definition.formulas?.[0]?.expression).toBe("(A + 2) ** 2");

    const unknownSeries = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        formulas: [{ expression: "A / B", key: "calculated" }],
      }).pipe(Effect.flip),
    );
    expect(unknownSeries.message).toContain("unknown series: b");

    const unsafeSyntax = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        formulas: [{ expression: "globalThis.process", key: "calculated" }],
      }).pipe(Effect.flip),
    );
    expect(unsafeSyntax.message).toContain("Unexpected character");
  });

  it("requires a safe numeric event property for property aggregations", async () => {
    const definition = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        series: [{ ...eventSeries, aggregation: "property_average", mathProperty: "duration_ms" }],
      }),
    );
    expect(definition.series[0].mathProperty).toBe("duration_ms");

    const missingProperty = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        series: [{ ...eventSeries, aggregation: "property_sum" }],
      }).pipe(Effect.flip),
    );
    expect(missingProperty.message).toContain("requires an event property");

    const unusedProperty = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        series: [{ ...eventSeries, mathProperty: "duration_ms" }],
      }).pipe(Effect.flip),
    );
    expect(unusedProperty.message).toContain("does not use an event property");
  });

  it("builds formula series with sparse buckets and aligned comparisons", async () => {
    const definition = await Effect.runPromise(
      validateExecutableTrendsDefinition({
        ...fixtures[0],
        formulas: [{ expression: "A / B * 100", key: "rate", label: "Activation rate" }],
        series: [eventSeries, { ...eventSeries, eventNames: ["activated"], key: "B" }],
      }),
    );
    const first = new Date("2026-07-06T00:00:00.000Z");
    const second = new Date("2026-07-07T00:00:00.000Z");
    const result = await Effect.runPromise(
      buildTrendsFormulaSeries(definition, [
        {
          comparison: "current",
          key: "A",
          label: "A",
          points: [
            { timestamp: first, value: 10 },
            { timestamp: second, value: 5 },
          ],
        },
        {
          comparison: "current",
          key: "B",
          label: "B",
          points: [{ timestamp: first, value: 20 }],
        },
        {
          comparison: "previous_period",
          key: "A:comparison:previous_period",
          label: "A (previous period)",
          points: [{ timestamp: first, value: 4 }],
        },
        {
          comparison: "previous_period",
          key: "B:comparison:previous_period",
          label: "B (previous period)",
          points: [{ timestamp: first, value: 8 }],
        },
      ]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      comparison: "current",
      key: "rate",
      label: "Activation rate",
      points: [
        { timestamp: first, value: 50 },
        { timestamp: second, value: 0 },
      ],
    });
    expect(result[1]).toMatchObject({
      comparison: "previous_period",
      key: "rate:comparison:previous_period",
      label: "Activation rate (previous period)",
      points: [{ timestamp: first, value: 50 }],
    });
  });
});

describe("executable funnels", () => {
  it("accepts sequential, strict, and any-order funnels", async () => {
    for (const order of ["sequential", "strict", "any"] as const) {
      const definition = await Effect.runPromise(
        validateExecutableFunnelsDefinition({ ...fixtures[1], order }),
      );
      expect(definition.order).toBe(order);
    }
  });

  it("accepts a validated breakdown attribution step", async () => {
    const definition = await Effect.runPromise(
      validateExecutableFunnelsDefinition({
        ...fixtures[1],
        breakdown: { field: "event.properties.platform", limit: 5 },
        breakdownAttributionStep: 2,
      }),
    );
    expect(definition.breakdown?.field).toBe("event.properties.platform");
    expect(definition.breakdownAttributionStep).toBe(2);

    const error = await Effect.runPromise(
      validateExecutableFunnelsDefinition({
        ...fixtures[1],
        breakdown: { field: "event.properties.platform" },
        breakdownAttributionStep: 3,
      }).pipe(Effect.flip),
    );
    expect(error.message).toContain("existing step");
  });

  it("rejects one-step funnels and unsafe conversion windows", async () => {
    const oneStepError = await Effect.runPromise(
      validateExecutableFunnelsDefinition({
        ...fixtures[1],
        steps: [fixtures[1].steps[0]],
      }).pipe(Effect.flip),
    );
    expect(oneStepError).toBeInstanceOf(InvalidAnalyticsQueryError);

    const windowError = await Effect.runPromise(
      validateExecutableFunnelsDefinition({
        ...fixtures[1],
        conversionWindowSeconds: 31_536_001,
      }).pipe(Effect.flip),
    );
    expect(windowError.message).toContain("365 days");
  });

  it("derives conversion and drop-off metrics from reach counts", async () => {
    const definition = await Effect.runPromise(validateExecutableFunnelsDefinition(fixtures[1]));
    const steps = buildFunnelStepResults(definition, [100, 64]);

    expect(steps[0]).toMatchObject({ conversionRate: 1, count: 100, dropoffCount: 0 });
    expect(steps[1]).toMatchObject({
      conversionRate: 0.64,
      count: 64,
      dropoffCount: 36,
      dropoffRate: 0.36,
    });
  });
});

describe("executable retention", () => {
  it("accepts recurring and first-time cohort definitions", async () => {
    for (const retentionType of ["recurring", "first_time"] as const) {
      const definition = await Effect.runPromise(
        validateExecutableRetentionDefinition({
          ...fixtures[2],
          cumulative: true,
          intervals: 8,
          reference: "cohort",
          retentionType,
        }),
      );
      expect(definition.retentionType).toBe(retentionType);
    }
  });

  it("rejects invalid interval counts", async () => {
    const error = await Effect.runPromise(
      validateExecutableRetentionDefinition({
        ...fixtures[2],
        intervals: 25,
      }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect(error.message).toContain("24 intervals");
  });

  it("calculates cohort-relative and previous-period rates", async () => {
    const base = await Effect.runPromise(
      validateExecutableRetentionDefinition({ ...fixtures[2], intervals: 3 }),
    );
    const raw = [
      {
        cohortSize: 100,
        cohortStart: new Date("2026-07-01T00:00:00.000Z"),
        counts: [80, 40, 20],
      },
    ];
    expect(buildRetentionCohortResults(base, raw)[0]?.cells.map((cell) => cell.rate)).toEqual([
      0.8, 0.4, 0.2,
    ]);
    expect(
      buildRetentionCohortResults({ ...base, reference: "previous" }, raw)[0]?.cells.map(
        (cell) => cell.rate,
      ),
    ).toEqual([0.8, 0.5, 0.5]);
  });
});

describe("executable paths", () => {
  it("accepts mobile screen paths with session and density controls", async () => {
    const definition = await Effect.runPromise(
      validateExecutablePathsDefinition({
        ...fixtures[3],
        collapseRepeated: true,
        edgeLimit: 80,
        filters: {
          field: "event.properties.platform",
          op: "eq",
          type: "predicate",
          value: "ios",
        },
        pathItem: "screen_name",
        sessionGapSeconds: 1_800,
      }),
    );
    expect(definition.pathItem).toBe("screen_name");
    expect(definition.sessionGapSeconds).toBe(1_800);
  });

  it("rejects empty endpoints and inverted edge-density controls", async () => {
    const endpointError = await Effect.runPromise(
      validateExecutablePathsDefinition({
        ...fixtures[3],
        startEventName: "",
      }).pipe(Effect.flip),
    );
    expect(endpointError).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect(endpointError.message).toContain("cannot be empty");

    const densityError = await Effect.runPromise(
      validateExecutablePathsDefinition({
        ...fixtures[3],
        maxEdgeCount: 4,
        minEdgeCount: 5,
      }).pipe(Effect.flip),
    );
    expect(densityError.message).toContain("minimum link count");
  });

  it("normalizes path links without changing transition-frequency semantics", () => {
    expect(
      buildPathsLinkResults([
        {
          averageTransitionSeconds: 12.5,
          count: 7,
          source: "Home",
          sourceStep: 1,
          target: "Paywall",
          targetStep: 2,
        },
      ]),
    ).toEqual([
      {
        averageTransitionSeconds: 12.5,
        count: 7,
        source: "Home",
        sourceStep: 1,
        target: "Paywall",
        targetStep: 2,
      },
    ]);
  });
});

describe("executable stickiness", () => {
  it("accepts exact and cumulative frequency definitions", async () => {
    for (const computation of ["exact", "cumulative"] as const) {
      const definition = await Effect.runPromise(
        validateExecutableStickinessDefinition({
          ...fixtures[4],
          computation,
          occurrenceCriteria: { operator: "gte", value: 2 },
        }),
      );
      expect(definition.computation).toBe(computation);
    }
  });

  it("rejects more than eight series", async () => {
    const error = await Effect.runPromise(
      validateExecutableStickinessDefinition({
        ...fixtures[4],
        series: Array.from({ length: 9 }, (_, index) => ({
          ...eventSeries,
          key: String(index),
        })) as [typeof eventSeries, ...(typeof eventSeries)[]],
      }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect(error.message).toContain("8 series");
  });

  it("fills exact gaps and builds at-least-N cumulative buckets", () => {
    const raw = [
      { count: 5, intervals: 1 },
      { count: 2, intervals: 3 },
    ];
    expect(buildStickinessBuckets(raw, "exact", 4)).toEqual([
      { count: 5, intervals: 1 },
      { count: 0, intervals: 2 },
      { count: 2, intervals: 3 },
      { count: 0, intervals: 4 },
    ]);
    expect(buildStickinessBuckets(raw, "cumulative", 4)).toEqual([
      { count: 7, intervals: 1 },
      { count: 2, intervals: 2 },
      { count: 2, intervals: 3 },
      { count: 0, intervals: 4 },
    ]);
  });

  it("counts inclusive hourly, weekly, and monthly buckets", () => {
    expect(
      countStickinessIntervals(
        new Date("2026-07-13T10:30:00Z"),
        new Date("2026-07-13T12:00:00Z"),
        "hour",
      ),
    ).toBe(3);
    expect(
      countStickinessIntervals(
        new Date("2026-07-12T00:00:00Z"),
        new Date("2026-07-13T00:00:00Z"),
        "week",
      ),
    ).toBe(2);
    expect(
      countStickinessIntervals(
        new Date("2025-12-31T00:00:00Z"),
        new Date("2026-02-01T00:00:00Z"),
        "month",
      ),
    ).toBe(3);
  });

  it("rejects event-count aggregation", async () => {
    const error = await Effect.runPromise(
      validateExecutableStickinessDefinition({
        ...fixtures[4],
        series: [{ ...eventSeries, aggregation: "total_events" }],
      }).pipe(Effect.flip),
    );
    expect(error.message).toContain("unique users");
  });
});

describe("executable lifecycle", () => {
  it("accepts selected lifecycle statuses and rejects event aggregation", async () => {
    const definition = await Effect.runPromise(
      validateExecutableLifecycleDefinition({
        ...fixtures[5],
        display: "stacked_area",
        statuses: ["new", "returning", "dormant"],
      }),
    );
    expect(definition.statuses).toEqual(["new", "returning", "dormant"]);

    const error = await Effect.runPromise(
      validateExecutableLifecycleDefinition({
        ...fixtures[5],
        series: { ...eventSeries, aggregation: "total_events" },
      }).pipe(Effect.flip),
    );
    expect(error.message).toContain("unique users");
  });

  it("fills every selected status across the inclusive range", () => {
    const series = buildLifecycleSeries(
      [
        { count: 2, status: "returning", timestamp: new Date("2026-07-02T00:00:00Z") },
        { count: 1, status: "dormant", timestamp: new Date("2026-07-03T00:00:00Z") },
      ],
      ["returning", "dormant"],
      new Date("2026-07-01T12:00:00Z"),
      new Date("2026-07-03T18:00:00Z"),
      "day",
    );
    expect(series.map((item) => [item.status, item.points.map((point) => point.count)])).toEqual([
      ["returning", [0, 2, 0]],
      ["dormant", [0, 0, 1]],
    ]);
  });
});
