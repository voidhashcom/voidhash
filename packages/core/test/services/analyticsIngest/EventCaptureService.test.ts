import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  type CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import type {
  CaptureProjectPolicy,
  RouteClass,
  RouteDecision,
} from "../../../src/domain/analyticsIngest/AnalyticsIngest.ts";
import {
  CAPTURE_TOPIC_DLQ,
  CAPTURE_TOPIC_HISTORICAL,
  CAPTURE_TOPIC_MAIN,
  CAPTURE_TOPIC_OVERFLOW,
  makeEnvelope,
  resolveEventTimestamp,
  selectRoute,
  tokenSuffix,
  validateCaptureToken,
} from "../../../src/services/analyticsIngest/EventCaptureService.ts";

// =============================================================================
// Fixtures (fresh per test via const-returning builders)
// =============================================================================

const policy = (overrides: Partial<CaptureProjectPolicy> = {}): CaptureProjectPolicy => ({
  ingestEnabled: true,
  projectId: "proj_123",
  skipEnrichment: false,
  ...overrides,
});

const route = (overrides: Partial<RouteDecision> = {}): RouteDecision => ({
  isHistorical: false,
  routeClass: "main",
  skipEnrichment: false,
  targetTopic: CAPTURE_TOPIC_MAIN,
  ...overrides,
});

const captureEvent = (
  overrides: Partial<typeof CaptureEvent.Type> = {},
): typeof CaptureEvent.Type => ({
  uuid: "evt_uuid_1",
  event: "page_view",
  context: { library: "web" },
  properties: { plan: "pro" },
  distinct_id: "user_42",
  ...overrides,
});

const envelopeArgs = (
  overrides: {
    event?: typeof CaptureEvent.Type;
    route?: RouteDecision;
    request?: {
      readonly clientIp?: string;
      readonly headers: Readonly<Record<string, string | undefined>>;
      readonly path?: string;
      readonly requestId: string;
    };
    receivedAt?: Date;
    sentAt?: Date;
    token?: string;
    organizationId?: string;
    projectId?: string;
  } = {},
) => ({
  event: overrides.event ?? captureEvent(),
  organizationId: overrides.organizationId ?? "org_1",
  projectId: overrides.projectId ?? "proj_123",
  receivedAt: overrides.receivedAt ?? new Date("2026-01-01T00:00:05.000Z"),
  request: overrides.request ?? {
    headers: { "user-agent": "test-agent" },
    requestId: "req_1",
  },
  route: overrides.route ?? route(),
  sentAt: overrides.sentAt ?? new Date("2026-01-01T00:00:02.000Z"),
  token: overrides.token ?? "vh_pk_abcd1234",
});

// =============================================================================
// validateCaptureToken (returns an Effect; run with Effect.runPromise / flip)
// =============================================================================

describe("validateCaptureToken", () => {
  it("accepts a token matching the vh_pk_* format and returns it", async () => {
    const result = await Effect.runPromise(validateCaptureToken("vh_pk_abcd1234"));
    expect(result).toBe("vh_pk_abcd1234");
  });

  it("trims surrounding whitespace before validating and returns the trimmed token", async () => {
    const result = await Effect.runPromise(validateCaptureToken("  vh_pk_abcd1234\n"));
    expect(result).toBe("vh_pk_abcd1234");
  });

  it("rejects an empty token with CaptureUnauthorizedError 'missing token'", async () => {
    // `Effect.flip` moves the typed error into the success channel so we can
    // assert on its concrete type without poking into the Cause.
    const error = await Effect.runPromise(validateCaptureToken("").pipe(Effect.flip));
    expect(error).toBeInstanceOf(CaptureUnauthorizedError);
    expect(error.error).toBe("missing token");
    expect(error.code).toBe("unauthorized");
  });

  it("treats a whitespace-only token as missing", async () => {
    const error = await Effect.runPromise(validateCaptureToken("   ").pipe(Effect.flip));
    expect(error).toBeInstanceOf(CaptureUnauthorizedError);
    expect(error.error).toBe("missing token");
  });

  it.each([
    ["pk_abcd1234", "wrong prefix"],
    ["vh_pk_", "empty body"],
    ["vh_pk_abc-123", "non-word char"],
    ["VH_PK_ABCD", "uppercase prefix"],
  ])("rejects malformed token %j (%s) with 'invalid token format'", async (token) => {
    const error = await Effect.runPromise(validateCaptureToken(token).pipe(Effect.flip));
    expect(error).toBeInstanceOf(CaptureUnauthorizedError);
    expect(error.error).toBe("invalid token format");
    expect(error.code).toBe("unauthorized");
  });
});

// =============================================================================
// tokenSuffix
// =============================================================================

describe("tokenSuffix", () => {
  it("returns the last 4 characters of a token", () => {
    expect(tokenSuffix("vh_pk_abcd1234")).toBe("1234");
  });

  it("returns the whole string when shorter than 4 characters", () => {
    expect(tokenSuffix("ab")).toBe("ab");
  });
});

// =============================================================================
// resolveEventTimestamp (pure)
// =============================================================================

describe("resolveEventTimestamp", () => {
  const receivedAt = new Date("2026-01-01T00:00:05.000Z");
  const sentAt = new Date("2026-01-01T00:00:02.000Z");
  const timestamp = new Date("2026-01-01T00:00:01.000Z");

  it("returns the explicit timestamp when provided (highest priority)", () => {
    expect(resolveEventTimestamp({ receivedAt, sentAt, timestamp })).toBe(timestamp);
  });

  it("falls back to sentAt when timestamp is missing", () => {
    expect(resolveEventTimestamp({ receivedAt, sentAt })).toBe(sentAt);
  });

  it("falls back to receivedAt when both timestamp and sentAt are missing", () => {
    expect(resolveEventTimestamp({ receivedAt })).toBe(receivedAt);
  });
});

// =============================================================================
// selectRoute (returns an Effect)
// =============================================================================

describe("selectRoute", () => {
  it("routes to 'main'/CAPTURE_TOPIC_MAIN when not over quota and no forceRoute", async () => {
    const decision = await Effect.runPromise(selectRoute({ overQuota: false, policy: policy() }));
    expect(decision).toStrictEqual({
      isHistorical: false,
      routeClass: "main",
      skipEnrichment: false,
      targetTopic: CAPTURE_TOPIC_MAIN,
    });
  });

  it("routes to 'overflow'/CAPTURE_TOPIC_OVERFLOW when over quota", async () => {
    const decision = await Effect.runPromise(selectRoute({ overQuota: true, policy: policy() }));
    expect(decision.routeClass).toBe("overflow");
    expect(decision.targetTopic).toBe(CAPTURE_TOPIC_OVERFLOW);
    expect(decision.isHistorical).toBe(false);
  });

  it.each<[Exclude<RouteClass, "custom">, string, boolean]>([
    ["main", CAPTURE_TOPIC_MAIN, false],
    ["overflow", CAPTURE_TOPIC_OVERFLOW, false],
    ["historical", CAPTURE_TOPIC_HISTORICAL, true],
    ["dlq", CAPTURE_TOPIC_DLQ, false],
  ])(
    "respects forceRoute=%s (topic %s, isHistorical=%s) even when over quota",
    async (forceRoute, expectedTopic, expectedHistorical) => {
      const decision = await Effect.runPromise(
        // overQuota is intentionally true to prove forceRoute wins over the quota fallback.
        selectRoute({ overQuota: true, policy: policy({ forceRoute }) }),
      );
      expect(decision.routeClass).toBe(forceRoute);
      expect(decision.targetTopic).toBe(expectedTopic);
      expect(decision.isHistorical).toBe(expectedHistorical);
    },
  );

  it("rejects forceRoute='custom' with CaptureRateLimitedError", async () => {
    const error = await Effect.runPromise(
      selectRoute({ overQuota: false, policy: policy({ forceRoute: "custom" }) }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(CaptureRateLimitedError);
    expect(error.code).toBe("rate_limited");
    expect(error.error).toBe("custom routes are not supported in this deployment");
  });

  it("carries skipEnrichment through from the policy into the RouteDecision", async () => {
    const decision = await Effect.runPromise(
      selectRoute({ overQuota: false, policy: policy({ skipEnrichment: true }) }),
    );
    expect(decision.skipEnrichment).toBe(true);
  });

  it("sets isHistorical=true only for the historical route", async () => {
    const main = await Effect.runPromise(selectRoute({ overQuota: false, policy: policy() }));
    const historical = await Effect.runPromise(
      selectRoute({ overQuota: false, policy: policy({ forceRoute: "historical" }) }),
    );
    expect(main.isHistorical).toBe(false);
    expect(historical.isHistorical).toBe(true);
  });
});

// =============================================================================
// makeEnvelope (pure)
// =============================================================================

describe("makeEnvelope", () => {
  it("builds a CapturedEventV1 with schema version, captureId, routing, ids and timestamps", () => {
    const envelope = makeEnvelope(envelopeArgs());
    expect(envelope.schemaVersion).toBe(1);
    expect(typeof envelope.captureId).toBe("string");
    expect(envelope.captureId.length).toBeGreaterThan(0);
    expect(envelope.organizationId).toBe("org_1");
    expect(envelope.projectId).toBe("proj_123");
    expect(envelope.token).toBe("vh_pk_abcd1234");
    expect(envelope.event).toBe("page_view");
    expect(envelope.distinctId).toBe("user_42");
    expect(envelope.context).toStrictEqual({ library: "web" });
    expect(envelope.routing).toStrictEqual(route());
    // sentAt (2s) is preferred over receivedAt (5s) since no event.timestamp.
    expect(envelope.eventTimestamp).toBe("2026-01-01T00:00:02.000Z");
    expect(envelope.receivedAt).toBe("2026-01-01T00:00:05.000Z");
    expect(envelope.sentAt).toBe("2026-01-01T00:00:02.000Z");
    expect(envelope.request.requestId).toBe("req_1");
    expect(envelope.request.userAgent).toBe("test-agent");
  });

  it("uses resolveEventTimestamp: explicit event.timestamp wins over sentAt/receivedAt", () => {
    const envelope = makeEnvelope(
      envelopeArgs({
        event: captureEvent({ timestamp: new Date("2025-12-31T23:59:00.000Z") }),
      }),
    );
    expect(envelope.eventTimestamp).toBe("2025-12-31T23:59:00.000Z");
  });

  it("includes clientEventId when the event uuid is provided", () => {
    const envelope = makeEnvelope(envelopeArgs({ event: captureEvent({ uuid: "evt_uuid_99" }) }));
    expect(envelope.clientEventId).toBe("evt_uuid_99");
  });

  it("includes sessionId when session_id is provided", () => {
    const envelope = makeEnvelope(envelopeArgs({ event: captureEvent({ session_id: "sess_7" }) }));
    expect(envelope.sessionId).toBe("sess_7");
  });

  it("omits sessionId when session_id is absent", () => {
    const envelope = makeEnvelope(envelopeArgs());
    expect(envelope.sessionId).toBeUndefined();
  });

  it("adds $ip to canonical properties when clientIp is provided", () => {
    const envelope = makeEnvelope(
      envelopeArgs({
        request: { headers: { "user-agent": "ua" }, requestId: "req_2", clientIp: "1.2.3.4" },
      }),
    );
    expect((envelope.properties as Record<string, unknown>).$ip).toBe("1.2.3.4");
    expect(envelope.request.clientIp).toBe("1.2.3.4");
  });

  it("omits $ip when clientIp is absent", () => {
    const envelope = makeEnvelope(envelopeArgs());
    expect((envelope.properties as Record<string, unknown>).$ip).toBeUndefined();
    expect(envelope.request.clientIp).toBeUndefined();
  });

  it("sets $process_person_profile=true for a non-anonymous distinct id", () => {
    const envelope = makeEnvelope(
      envelopeArgs({ event: captureEvent({ distinct_id: "real_user" }) }),
    );
    expect((envelope.properties as Record<string, unknown>).$process_person_profile).toBe(true);
  });

  it("sets $process_person_profile=false for an anonymous distinct id", () => {
    const envelope = makeEnvelope(
      envelopeArgs({
        event: captureEvent({ distinct_id: `${ANONYMOUS_USER_ID_PREFIX}abc` }),
      }),
    );
    expect((envelope.properties as Record<string, unknown>).$process_person_profile).toBe(false);
  });

  it("honors a client-supplied $process_person_profile=true for an anonymous distinct id", () => {
    // An explicit `setPersonAttributes` `$set` stamps this so anonymous users
    // still get a person; the envelope must not override it back to false.
    const envelope = makeEnvelope(
      envelopeArgs({
        event: captureEvent({
          distinct_id: `${ANONYMOUS_USER_ID_PREFIX}abc`,
          properties: { $set: { age: 25 }, $process_person_profile: true },
        }),
      }),
    );
    expect((envelope.properties as Record<string, unknown>).$process_person_profile).toBe(true);
  });

  it("honors a client-supplied $process_person_profile=false for a non-anonymous distinct id", () => {
    const envelope = makeEnvelope(
      envelopeArgs({
        event: captureEvent({
          distinct_id: "real_user",
          properties: { $process_person_profile: false },
        }),
      }),
    );
    expect((envelope.properties as Record<string, unknown>).$process_person_profile).toBe(false);
  });

  it("falls back to the distinct-id default when $process_person_profile is not a boolean", () => {
    const envelope = makeEnvelope(
      envelopeArgs({
        event: captureEvent({
          distinct_id: `${ANONYMOUS_USER_ID_PREFIX}abc`,
          properties: { $process_person_profile: "yes" },
        }),
      }),
    );
    expect((envelope.properties as Record<string, unknown>).$process_person_profile).toBe(false);
  });
});
