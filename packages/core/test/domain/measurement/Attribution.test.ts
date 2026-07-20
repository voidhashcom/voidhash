import { describe, expect, it } from "vitest";

import {
  evaluateAttribution,
  recomputeAttribution,
  toSafeAttributionResponse,
  type AttributionRuleSet,
  type AttributionTouchpoint,
} from "../../../src/domain/measurement/Attribution";

const rules: AttributionRuleSet = {
  lookbackMs: 7 * 24 * 60 * 60 * 1_000,
  modelVersion: "last-touch-v1",
  priorities: ["install-referrer", "deferred-token", "cohort", "push-open", "deep-link"],
  ruleVersion: "rules-1",
};

const touch = (
  evidenceId: string,
  kind: AttributionTouchpoint["kind"],
  occurredAt = "2026-07-19T00:00:00.000Z",
  extra: Partial<AttributionTouchpoint> = {},
): AttributionTouchpoint => ({
  campaign: { campaign: evidenceId, mediaSource: kind },
  deterministic: kind !== "cohort",
  evidenceId,
  kind,
  occurredAt,
  ...extra,
});

const evaluate = (touchpoints: ReadonlyArray<AttributionTouchpoint>, overrides = {}) => evaluateAttribution({
  decisionId: "decision-1",
  decisionTime: "2026-07-20T00:00:01.000Z",
  kind: "install",
  ruleSet: rules,
  subjectOccurredAt: "2026-07-20T00:00:00.000Z",
  touchpoints,
  ...overrides,
});

describe("attribution engine", () => {
  it("applies configured priority and stable tie breaking", () => {
    expect(evaluate([touch("cohort", "cohort"), touch("deferred", "deferred-token"), touch("referrer", "install-referrer")]).campaign?.campaign).toBe("referrer");
    expect(evaluate([touch("b", "deferred-token"), touch("a", "deferred-token")]).campaign?.campaign).toBe("a");
  });

  it("excludes evidence outside lookback and emits an explicit organic decision", () => {
    const decision = evaluate([touch("old", "install-referrer", "2026-01-01T00:00:00.000Z")]);
    expect(decision).toMatchObject({ confidence: "organic", evidenceIds: [], kind: "organic" });
    expect(decision.reasonTrace).toEqual([{ evidenceId: "old", outcome: "outside-lookback", rule: "install-referrer" }]);
  });

  it("attributes push and deep-link re-engagement without creating an install decision", () => {
    const decision = evaluate([
      touch("push", "push-open", undefined, { reengagement: true }),
      touch("link", "deep-link", undefined, { reengagement: true }),
    ], { kind: "reengagement" });
    expect(decision).toMatchObject({ kind: "reengagement", campaign: { campaign: "push" } });
  });

  it("is byte deterministic apart from injected decision identity and time", () => {
    const first = evaluate([touch("cohort", "cohort")]);
    const second = evaluate([touch("cohort", "cohort")], { decisionId: "decision-2", decisionTime: "2026-07-21T00:00:00.000Z" });
    const strip = ({ decisionId: _id, decidedAt: _time, ...value }: typeof first) => value;
    expect(JSON.stringify(strip(first))).toBe(JSON.stringify(strip(second)));
  });

  it("appends a new version and preserves source evidence", () => {
    const evidence = [touch("cohort", "cohort")];
    const checksum = JSON.stringify(evidence);
    const previous = evaluate(evidence);
    const recomputed = recomputeAttribution(previous, {
      decisionId: "decision-2",
      decisionTime: "2026-07-21T00:00:00.000Z",
      kind: "install",
      ruleSet: { ...rules, priorities: ["cohort"], ruleVersion: "rules-2" },
      subjectOccurredAt: "2026-07-20T00:00:00.000Z",
      touchpoints: evidence,
    });
    expect(recomputed.previous).toMatchObject({ decisionId: "decision-1", status: "superseded" });
    expect(recomputed.current).toMatchObject({ ruleVersion: "rules-2", supersededDecisionId: "decision-1" });
    expect(JSON.stringify(evidence)).toBe(checksum);
  });

  it("exposes only safe campaign and decision fields", () => {
    const serialized = JSON.stringify(toSafeAttributionResponse(evaluate([touch("referrer", "install-referrer")])));
    expect(serialized).not.toMatch(/url|token|referrerString|identifier/i);
  });
});
