import { describe, expect, it } from "vitest";

import { inferUninstalls, type PushDeliveryAttemptEvidence, type PushRegistrationEvidence } from "../../../src/domain/measurement/UninstallInference";

const registration = (overrides: Partial<PushRegistrationEvidence> = {}): PushRegistrationEvidence => ({
  environment: "production",
  installationId: "install-1",
  personId: "person-at-failure",
  pushDeviceTokenId: "token-id-1",
  registeredAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

const attempt = (overrides: Partial<PushDeliveryAttemptEvidence> = {}): PushDeliveryAttemptEvidence => ({
  attemptId: "attempt-invalid",
  occurredAt: "2026-07-20T00:00:00.000Z",
  provider: "apns",
  providerInvalidAt: "2026-07-19T00:00:00.000Z",
  pushDeviceTokenId: "token-id-1",
  result: "unregistered",
  ...overrides,
});

describe("uninstall inference", () => {
  it("infers a bounded window for the latest active token", () => {
    expect(inferUninstalls([registration()], [
      attempt({ attemptId: "success", occurredAt: "2026-07-10T00:00:00.000Z", providerInvalidAt: undefined, result: "success" }),
      attempt(),
    ])).toEqual([expect.objectContaining({
      confidence: "high",
      inferredAfter: "2026-07-10T00:00:00.000Z",
      inferredBefore: "2026-07-19T00:00:00.000Z",
      pushDeviceTokenId: "token-id-1",
      status: "active",
    })]);
  });

  it("ignores rotated, explicitly unregistered, stale, and transient feedback", () => {
    expect(inferUninstalls([
      registration({ pushDeviceTokenId: "old" }),
      registration({ previousPushDeviceTokenId: "old", pushDeviceTokenId: "new", registeredAt: "2026-07-15T00:00:00.000Z" }),
    ], [attempt({ pushDeviceTokenId: "old" })])).toEqual([]);
    expect(inferUninstalls([registration({ unregisteredAt: "2026-07-18T00:00:00.000Z" })], [attempt()])).toEqual([]);
    expect(inferUninstalls([registration()], [attempt({ providerInvalidAt: "2026-06-01T00:00:00.000Z" })])).toEqual([]);
    expect(inferUninstalls([registration()], [attempt({ result: "server-error" })])).toEqual([]);
  });

  it("keeps environment and identity-at-failure without exposing a platform token", () => {
    const inference = inferUninstalls([registration({ environment: "development" })], [attempt()])[0];
    expect(inference).toMatchObject({ environment: "development", personId: "person-at-failure" });
    expect(JSON.stringify(inference)).not.toMatch(/rawToken|platformToken|apnsToken|fcmToken/);
  });

  it("is deterministic and de-duplicates repeated invalid feedback", () => {
    const evidence = [attempt(), attempt({ attemptId: "attempt-invalid-2", occurredAt: "2026-07-21T00:00:00.000Z" })];
    expect(inferUninstalls([registration()], evidence)).toEqual(inferUninstalls([registration()], [...evidence].reverse()));
    expect(inferUninstalls([registration()], evidence)).toHaveLength(1);
  });
});
