import { describe, expect, it, vi } from "vitest";

import { applePostbackCohortKey, decodeAppleConversion, parseApplePostback } from "../../../src/domain/measurement/ApplePostback";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("Apple postback ingest domain", () => {
  it.each([
    ["skan", { "app-id": "123", "coarse-conversion-value": "high", "conversion-value": 7, "postback-sequence-index": 2, "source-identifier": "0042", version: "4.0" }],
    ["ad-attribution-kit", { advertisedItemId: "123", fineConversionValue: 4, postbackSequenceIndex: 0, publisherItemId: "publisher", version: "1.0" }],
  ] as const)("normalizes %s fixtures", async (framework, body) => {
    const result = await parseApplePostback({ body: encode(body), evidenceId: "evidence-1", framework, receivedAt: "2026-07-20T00:00:00.000Z" });
    expect(result.normalized).toMatchObject({ appId: "123", framework });
    expect(result.rawBody).toEqual(encode(body));
  });

  it("records verification failure without discarding raw evidence", async () => {
    const body = encode({ "app-id": "123", signature: "tampered", version: "4.0" });
    const verify = vi.fn(() => false);
    const result = await parseApplePostback({ body, evidenceId: "evidence-1", framework: "skan", receivedAt: "2026-07-20T00:00:00.000Z", verifySignature: verify });
    expect(result).toMatchObject({ verification: "failed" });
    expect(result.rawBody).toEqual(body);
    expect(verify).toHaveBeenCalledOnce();
  });

  it.each([
    [encode("not-an-object"), "invalid-shape"],
    [new TextEncoder().encode("{"), "invalid-json"],
    [new Uint8Array(100), "oversized"],
  ])("retains rejected input with typed reason", async (body, reason) => {
    const result = await parseApplePostback({
      body,
      evidenceId: "evidence-1",
      framework: "skan",
      maximumBytes: reason === "oversized" ? 10 : undefined,
      receivedAt: "2026-07-20T00:00:00.000Z",
    });
    expect(result.rejectionReason).toBe(reason);
    expect(result.rawBody).toEqual(body);
  });

  it("correlates the active rule version and decodes fine or coarse meaning", () => {
    const rules = [{ activeFrom: "2026-07-01T00:00:00.000Z", appId: "123", coarse: { high: "payer" }, fine: { 7: "trial-start" }, ruleVersion: "rules-2" }];
    const postback = { appId: "123", fineConversionValue: 7, framework: "skan" as const, rawVersion: "4.0" };
    expect(decodeAppleConversion(postback, "2026-07-20T00:00:00.000Z", rules)).toEqual({ meaning: "trial-start", ruleVersion: "rules-2", status: "decoded" });
    expect(decodeAppleConversion({ ...postback, appId: "unknown" }, "2026-07-20T00:00:00.000Z", rules)).toEqual({ status: "unknown-rule" });
  });

  it("creates an anonymous cohort key with no individual identity dimension", () => {
    const key = applePostbackCohortKey({ appId: "123", framework: "skan", postbackSequenceIndex: 1, rawVersion: "4.0" }, "campaign-1", "rules-2");
    expect(key).toBe("123:campaign-1:rules-2:1");
    expect(key).not.toMatch(/installation|person|device/);
  });
});
