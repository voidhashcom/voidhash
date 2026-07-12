/**
 * Unit tests for the pure claim-stamping in {@link AnalyticsDispatchService}.
 * The enqueue itself is a thin pass-through to {@link CaptureIngress}; the
 * load-bearing logic is deriving the SDK identity claim (`Anonymous` vs
 * `Stitch`) and stamping `trustClass: "untrusted-sdk"` server-side.
 */
import { describe, expect, it } from "vite-plus/test";

import type { CapturedEventV1Type } from "../../../src/domain/analyticsIngest/AnalyticsIngest.ts";
import { stampSdkIdentityClaim } from "../../../src/services/analyticsIngest/AnalyticsDispatchService.ts";

const capturedEvent = (overrides: Partial<CapturedEventV1Type> = {}): CapturedEventV1Type => ({
  schemaVersion: 1,
  captureId: "cap_1",
  token: "vh_pk_test",
  organizationId: "org_1",
  projectId: "proj_1",
  event: "checkout_started",
  distinctId: "dist_1",
  eventTimestamp: "2026-03-04T00:00:00.000Z",
  receivedAt: "2026-03-04T00:00:00.000Z",
  properties: { properties: {}, distinctId: "dist_1" },
  context: {},
  rawPayload: {},
  request: { requestId: "req_1" },
  routing: {
    routeClass: "main",
    targetTopic: "capture.main.v1",
    isHistorical: false,
    skipEnrichment: false,
  },
  ...overrides,
});

describe("stampSdkIdentityClaim", () => {
  it("stamps Anonymous for a non-identify event and trustClass untrusted-sdk", () => {
    const result = stampSdkIdentityClaim(capturedEvent({ distinctId: "anon_1" }));
    expect(result.identityClaim).toEqual({ _tag: "Anonymous", distinctId: "anon_1" });
    expect(result.trustClass).toBe("untrusted-sdk");
  });

  it("stamps Stitch for an $identify event carrying $previous_distinct_id (nested in properties)", () => {
    const result = stampSdkIdentityClaim(
      capturedEvent({
        event: "$identify",
        distinctId: "user_42",
        properties: { properties: { $previous_distinct_id: "anon_7" }, distinctId: "user_42" },
      }),
    );
    expect(result.identityClaim).toEqual({
      _tag: "Stitch",
      distinctId: "user_42",
      previousDistinctId: "anon_7",
    });
    expect(result.trustClass).toBe("untrusted-sdk");
  });

  it("falls back to Anonymous for an $identify event with no usable previous distinct id", () => {
    const result = stampSdkIdentityClaim(
      capturedEvent({
        event: "$identify",
        distinctId: "user_42",
        properties: { properties: { $previous_distinct_id: "" }, distinctId: "user_42" },
      }),
    );
    expect(result.identityClaim).toEqual({ _tag: "Anonymous", distinctId: "user_42" });
  });

  it("never sets a Resolved claim from the SDK path (trust cannot be self-asserted)", () => {
    const result = stampSdkIdentityClaim(capturedEvent());
    expect(result.identityClaim?._tag).not.toBe("Resolved");
  });
});
