import { describe, expect, it } from "vitest";

import {
  assertSafePublicValue,
  buildMeasurementSupportBundle,
  UnifiedMeasurementRuntime,
} from "../../src/core/measurement";

describe("measurement support bundle", () => {
  it("hashes state identifiers, omits endpoints, and retains support categories", async () => {
    const runtime = new UnifiedMeasurementRuntime({
      adapter: { makeId: (prefix) => `${prefix}_private`, now: () => new Date("2026-01-01T00:00:00.000Z") },
      baseUrl: "https://private.example",
      platform: "ios",
      publishableKey: "pk_secret",
    });
    await runtime.initialize();
    const state = await runtime.measurement.getState();
    const bundle = buildMeasurementSupportBundle(state, new Date("2026-01-02T00:00:00.000Z"));
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(state.installation.id);
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("pk_secret");
    expect(bundle).toMatchObject({
      generatedAt: "2026-01-02T00:00:00.000Z",
      collectors: expect.any(Object),
      configuration: expect.any(Object),
      consent: expect.any(Object),
      outbox: expect.any(Object),
      versions: expect.any(Object),
    });
  });

  it.each([
    { receipt: "secret" },
    { nested: { pushToken: "secret" } },
    { ordinary: "https://private.example/path" },
    { email: "person@example.com" },
  ])("rejects protected diagnostic injection %#", (value) => {
    expect(() => assertSafePublicValue(value, "supportBundle")).toThrow("Protected");
  });
});
