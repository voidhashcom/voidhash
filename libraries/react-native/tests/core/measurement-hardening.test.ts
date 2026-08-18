import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { UnifiedMeasurementRuntime } from "../../src/core/measurement";

const repositoryRoot = resolve(process.cwd(), "../..");

interface ParityTestMap {
  readonly groups: ReadonlyArray<{
    readonly rows: ReadonlyArray<string>;
    readonly testCase: string;
    readonly testFile: string;
  }>;
  readonly schemaVersion: number;
  readonly wontDo: ReadonlyArray<string>;
}

describe("measurement hardening matrix", () => {
  it("keeps the outbox bounded while retaining critical installation evidence", async () => {
    let id = 0;
    const runtime = new UnifiedMeasurementRuntime({
      adapter: { makeId: (prefix) => `${prefix}_${++id}` },
      baseUrl: "https://api.voidhash.test",
      platform: "ios",
      publishableKey: "pk_test",
    });
    await runtime.initialize();
    await runtime.consent.set({
      dataUsage: true,
      decidedAt: "2026-01-01T00:00:00.000Z",
      revision: 1,
      source: "application",
    });
    for (let index = 0; index < 10_025; index += 1) runtime.capture("load fixture", { index });
    const records = runtime.inspectOutbox();
    expect(records).toHaveLength(10_000);
    expect(records.some(({ type }) => type === "installation.created.v1")).toBe(true);
    expect(records.some(({ type }) => type === "consent.changed.v1")).toBe(true);
    expect(records.filter(({ type }) => type === "analytics.capture.v1")).toHaveLength(9_998);
  });

  it("keeps an executable source reference for every planned parity row", () => {
    const manifest = JSON.parse(readFileSync(
      resolve(repositoryRoot, "docs/react-native-measurement/parity-test-map.json"),
      "utf8",
    )) as ParityTestMap;
    const rows = manifest.groups.flatMap(({ rows: groupRows }) => groupRows);
    expect(new Set(rows).size).toBe(rows.length);
    expect(rows).toHaveLength(82);
    expect([...manifest.wontDo].sort()).toEqual(
      ["CONS-03", "PRIV-03", "PRIV-09", "PRIV-10", "PUR-02", "PUR-03"],
    );
    for (const group of manifest.groups) {
      const source = readFileSync(resolve(repositoryRoot, group.testFile), "utf8");
      expect(source, `${group.testFile} must contain ${group.testCase}`).toContain(group.testCase);
    }
  });

  it("enumerates all fourteen release scenarios without warning-only placeholders", () => {
    const manifest = JSON.parse(readFileSync(
      resolve(repositoryRoot, "docs/react-native-measurement/release-scenarios.json"),
      "utf8",
    )) as { readonly scenarios: ReadonlyArray<{ readonly automatedCase: string; readonly id: number }> };
    expect(manifest.scenarios.map(({ id }) => id)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    expect(manifest.scenarios.every(({ automatedCase }) => automatedCase.length > 0)).toBe(true);
  });
});
