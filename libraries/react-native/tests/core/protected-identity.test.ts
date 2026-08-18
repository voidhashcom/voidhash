import { describe, expect, it } from "vitest";

import {
  hashProtectedIdentityValue,
  normalizeProtectedEmail,
  normalizeProtectedIdentityTraits,
  normalizeProtectedPhone,
  UnifiedMeasurementRuntime,
  type MeasurementRuntimeAdapter,
} from "../../src/core/measurement";

const runtime = (adapter: MeasurementRuntimeAdapter = {}, dataUsage: boolean | undefined = true) =>
  new UnifiedMeasurementRuntime({
    adapter,
    baseUrl: "https://api.voidhash.com",
    consent: {
      dataUsage,
      decidedAt: "2026-07-20T00:00:00.000Z",
      revision: 2,
      source: "application",
    },
    measurement: { protectedIdentity: { email: true, enabled: true, phone: true } },
    platform: "ios",
    publishableKey: "vh_pk_test",
  });

describe("protected identity", () => {
  it("normalizes email and E.164 phone values deterministically", () => {
    expect(normalizeProtectedEmail("  Test@EXAMPLE.com ")).toBe("test@example.com");
    expect(normalizeProtectedPhone("00 1 (415) 555-2671")).toBe("+14155552671");
    expect(hashProtectedIdentityValue("test@example.com")).toBe(
      "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b",
    );
  });

  it("marks caller-hashed input and agrees with SDK hashing", () => {
    const hash = hashProtectedIdentityValue("test@example.com");
    const result = normalizeProtectedIdentityTraits({
      emails: [" Test@example.com ", { format: "sha256", value: hash }],
    });
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0]?.hash).toBe(hash);
  });

  it("writes plaintext only through the protected adapter and exposes opaque references publicly", async () => {
    const protectedWrites: Array<{ blobId: string; value: string }> = [];
    const publicWrites: unknown[] = [];
    const adapter: MeasurementRuntimeAdapter = {
      enqueueMeasurement: async (command) => { publicWrites.push(command.envelope); },
      putProtectedEvidence: async (input) => {
        protectedWrites.push({ blobId: input.blobId, value: new TextDecoder().decode(input.value) });
        return input.blobId;
      },
    };
    const result = await runtime(adapter).setProtectedIdentityTraits({
      emails: ["Test@example.com"],
      phones: ["+14155552671"],
    });
    expect(result.status).toBe("stored");
    expect(protectedWrites).toHaveLength(2);
    expect(protectedWrites.map(({ value }) => JSON.parse(value).normalized)).toEqual([
      "test@example.com",
      "+14155552671",
    ]);
    const serializedPublic = JSON.stringify(publicWrites);
    expect(serializedPublic).not.toContain("test@example.com");
    expect(serializedPublic).not.toContain("+14155552671");
    expect(result.references.every((reference) => serializedPublic.includes(reference))).toBe(true);
  });

  it("does not enqueue an opaque reference until its native vault write is durable", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const publicWrites: string[] = [];
    const update = runtime({
      enqueueMeasurement: async (command) => { publicWrites.push(command.recordType); },
      putProtectedEvidence: async (input) => {
        await gate;
        return input.blobId;
      },
    }).setProtectedIdentityTraits({ emails: ["test@example.com"] });
    await Promise.resolve();
    expect(publicWrites).toEqual([]);
    release();
    await update;
    expect(publicWrites).toEqual(["protected_identity.updated.v1"]);
  });

  it("returns an observable policy block without writing protected values", async () => {
    let writes = 0;
    const result = await runtime({ putProtectedEvidence: async (input) => { writes += 1; return input.blobId; } }, false)
      .setProtectedIdentityTraits({ emails: ["test@example.com"] });
    expect(result).toMatchObject({ status: "policyBlocked", references: [] });
    expect(writes).toBe(0);
  });

  it("is disabled by default and clears prior vault references explicitly", async () => {
    const disabled = new UnifiedMeasurementRuntime({
      baseUrl: "https://api.voidhash.com",
      platform: "android",
      publishableKey: "vh_pk_test",
    });
    await expect(disabled.setProtectedIdentityTraits({ emails: ["test@example.com"] })).resolves.toMatchObject({
      status: "disabled",
    });

    const deleted: string[] = [];
    const enabled = runtime({
      deleteProtectedEvidence: async (reference) => { deleted.push(reference); return true; },
      putProtectedEvidence: async (input) => input.blobId,
    });
    const stored = await enabled.setProtectedIdentityTraits({ emails: ["test@example.com"] });
    const cleared = await enabled.setProtectedIdentityTraits({ clearEmails: true });
    expect(deleted).toEqual(stored.references);
    expect(cleared.cleared).toEqual(["email"]);
  });
});
