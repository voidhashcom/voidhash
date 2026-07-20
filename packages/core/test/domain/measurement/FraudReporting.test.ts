import { describe, expect, it } from "vitest";

import { aggregateMeasurementReport, buildMeasurementRawExport, evaluateFraud, type FraudEvidence } from "../../../src/domain/measurement/FraudReporting";

const rules = {
  maximumClicksPerWindow: 2,
  maximumInstallDelayMs: 7 * 24 * 60 * 60 * 1_000,
  minimumInstallDelayMs: 1_000,
  ruleVersion: "fraud-1",
  windowMs: 60_000,
};

const evidence: FraudEvidence[] = [
  { clickId: "click-1", evidenceId: "click-a", kind: "click", occurredAt: "2026-07-20T00:00:00.000Z" },
  { clickId: "click-2", evidenceId: "click-b", kind: "click", occurredAt: "2026-07-20T00:00:10.000Z" },
  { clickId: "click-3", evidenceId: "click-c", kind: "click", occurredAt: "2026-07-20T00:00:20.000Z" },
  { clickId: "click-1", evidenceId: "install-a", installReferrerClickId: "different", kind: "install", occurredAt: "2026-07-20T00:00:00.100Z" },
  { evidenceId: "replay-a", kind: "token-replay", occurredAt: "2026-07-20T00:00:30.000Z" },
];

describe("fraud and reporting", () => {
  it("flags every shipped heuristic deterministically without mutating evidence", () => {
    const checksum = JSON.stringify(evidence);
    const flags = evaluateFraud(evidence, rules);
    expect(flags.map(({ reason }) => reason).sort()).toEqual([
      "click-flooding",
      "click-to-install-anomaly",
      "referrer-click-mismatch",
      "token-replay",
    ]);
    expect(evaluateFraud([...evidence].reverse(), rules)).toEqual(flags);
    expect(JSON.stringify(evidence)).toBe(checksum);
    expect(flags.every(({ severity }) => severity === "block")).toBe(true);
  });

  it("exports all non-deleted layers while recursively removing protected fields", () => {
    const rows = [
      { payload: { campaign: "summer", nested: { ciphertext: "secret", safe: true }, rawUrl: "private" }, recordId: "raw-1", schemaVersion: 1, type: "click" },
      { payload: { campaign: "summer" }, recordId: "derived-1", schemaVersion: 1, type: "touchpoint" },
      { payload: { campaign: "winter" }, recordId: "decision-1", schemaVersion: 1, type: "decision" },
      { deleted: true, payload: { campaign: "deleted" }, recordId: "deleted-1", schemaVersion: 1, type: "click" },
    ];
    const exported = buildMeasurementRawExport(rows);
    expect(exported.map(({ recordId }) => recordId)).toEqual(["raw-1", "derived-1", "decision-1"]);
    expect(JSON.stringify(exported)).not.toContain("secret");
    expect(JSON.stringify(exported)).not.toContain("private");
    expect(aggregateMeasurementReport(rows)).toEqual({
      byCampaign: { summer: 2, winter: 1 },
      byType: { click: 1, decision: 1, touchpoint: 1 },
      total: 3,
    });
  });
});
