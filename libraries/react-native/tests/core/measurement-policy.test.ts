import { describe, expect, it, vi } from "vitest";

import {
  evaluateMeasurementCollection,
  fetchSignedMeasurementConfiguration,
  filterPartnerPayload,
  SignedMeasurementConfigurationVerifier,
  type CollectionPolicy,
  type ConsentSnapshot,
} from "../../src/core/measurement";

const policy: CollectionPolicy = {
  advertisingIdentifiers: "consent-dependent",
  analytics: "enabled",
  attribution: "enabled",
  location: "manual-only",
  networkMetadata: "denied",
  upload: "enabled",
  vendorIdentifiers: "consent-dependent",
};

const consent = (overrides: Partial<ConsentSnapshot> = {}): ConsentSnapshot => ({
  decidedAt: "2026-07-20T00:00:00.000Z",
  revision: 4,
  source: "application",
  ...overrides,
});

describe("measurement policy", () => {
  it.each([
    ["analytics", {}, true, "allowed"],
    ["advertisingIdentifier", {}, false, "consent-denied"],
    ["advertisingIdentifier", { adStorage: true }, true, "allowed"],
    ["vendorIdentifier", { dataUsage: false }, false, "consent-denied"],
    ["vendorIdentifier", { dataUsage: true }, true, "allowed"],
    ["networkMetadata", {}, false, "disabled"],
    ["location", {}, false, "manual-only"],
  ] as const)("evaluates %s independently", (category, overrides, allowed, reason) => {
    expect(evaluateMeasurementCollection(category, policy, consent(overrides))).toMatchObject({ allowed, reason });
  });

  it("gives collection opt-out precedence over all individual grants", () => {
    expect(evaluateMeasurementCollection("analytics", policy, consent({ collectionOptOut: true }))).toMatchObject({
      allowed: false,
      reason: "collection-opt-out",
    });
  });

  it("filters excluded partner fields at send time without mutating evidence", () => {
    const payload = { campaign: "summer", emailHash: "abc", revenue: 10 };
    const decision = filterPartnerPayload("partner-a", payload, {
      excludedFields: { "partner-a": ["emailHash"] },
      mode: "enabled",
    }, consent());
    expect(decision).toEqual({
      allowed: true,
      consentRevision: 4,
      payload: { campaign: "summer", revenue: 10 },
      reason: "allowed",
    });
    expect(payload).toEqual({ campaign: "summer", emailHash: "abc", revenue: 10 });
  });

  it.each([
    [{ mode: "disabled" as const }, {}, "partner-sharing-disabled"],
    [{ mode: "enabled" as const, excludedPartners: ["partner-a"] }, {}, "partner-excluded"],
    [{ mode: "enabled" as const }, { partnerSharingOptOut: true }, "consent-denied"],
  ])("denies partner sharing with an observable reason", (sharing, consentOverrides, reason) => {
    expect(filterPartnerPayload("partner-a", { campaign: "summer" }, sharing, consent(consentOverrides))).toMatchObject({
      allowed: false,
      reason,
    });
  });
});

describe("SignedMeasurementConfigurationVerifier", () => {
  const configuration = {
    expiresAt: "2026-08-01T00:00:00.000Z",
    keyId: "key-1",
    payload: { rules: [{ conversion: 2, name: "trial" }] },
    projectId: "project-1",
    signature: "signed",
    version: 2,
  } as const;

  it("verifies canonical bytes and retains the last valid version", async () => {
    const key = vi.fn((_bytes: Uint8Array, _signature: string) => true);
    const verifier = new SignedMeasurementConfigurationVerifier(
      "project-1",
      new Map([["key-1", key]]),
      () => new Date("2026-07-20T00:00:00.000Z"),
      1,
    );
    await expect(verifier.verify(configuration)).resolves.toEqual(configuration.payload);
    expect(new TextDecoder().decode(key.mock.calls[0]?.[0])).toBe(
      '{"expiresAt":"2026-08-01T00:00:00.000Z","keyId":"key-1","payload":{"rules":[{"conversion":2,"name":"trial"}]},"projectId":"project-1","version":2}',
    );
    expect(verifier.getState()).toEqual({ keyId: "key-1", payload: configuration.payload, version: 2 });
  });

  it.each([
    [{ ...configuration, expiresAt: "2026-01-01T00:00:00.000Z" }, "expired"],
    [{ ...configuration, keyId: "unknown" }, "unknown-key"],
    [{ ...configuration, projectId: "project-2" }, "project-mismatch"],
    [{ ...configuration, version: 1 }, "version-replay"],
  ] as const)("rejects invalid signed configuration as %s", async (candidate, code) => {
    const verifier = new SignedMeasurementConfigurationVerifier(
      "project-1",
      new Map([["key-1", () => true]]),
      () => new Date("2026-07-20T00:00:00.000Z"),
      1,
    );
    await expect(verifier.verify(candidate)).rejects.toMatchObject({ code });
  });

  it("does not replace the accepted configuration after a signature failure", async () => {
    const verifier = new SignedMeasurementConfigurationVerifier(
      "project-1",
      new Map([["key-1", (_bytes, signature) => signature === "signed"]]),
      () => new Date("2026-07-20T00:00:00.000Z"),
    );
    await verifier.verify(configuration);
    await expect(verifier.verify({ ...configuration, signature: "bad", version: 3 })).rejects.toMatchObject({
      code: "invalid-signature",
    });
    expect(verifier.getState().version).toBe(2);
  });

  it("fetches the config endpoint and verifies an Ed25519 response end to end", async () => {
    const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const publicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
    const encode = (value: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(value)));
    const unsigned = {
      expiresAt: "2099-08-01T00:00:00.000Z",
      keyId: "key-1",
      payload: { schemaVersion: 1 },
      projectId: "project-1",
      version: 2,
    };
    const canonical =
      '{"expiresAt":"2099-08-01T00:00:00.000Z","keyId":"key-1","payload":{"schemaVersion":1},"projectId":"project-1","version":2}';
    const signature = encode(
      await crypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(canonical)),
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ ...unsigned, signature }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await expect(
      fetchSignedMeasurementConfiguration<{ readonly schemaVersion: number }>({
        endpoint: "https://ingest.example",
        expectedProjectId: "project-1",
        fetch,
        persistedVersion: 1,
        publishableKey: "vh_pk_test",
        trustedKeys: [{ keyId: "key-1", publicKeySpki: encode(publicKey) }],
      }),
    ).resolves.toEqual({ keyId: "key-1", payload: { schemaVersion: 1 }, version: 2 });
    expect(fetch).toHaveBeenCalledWith(
      "https://ingest.example/i/v1/measurement/config",
      expect.objectContaining({ headers: { "x-publishable-key": "vh_pk_test" } }),
    );
  });
});
