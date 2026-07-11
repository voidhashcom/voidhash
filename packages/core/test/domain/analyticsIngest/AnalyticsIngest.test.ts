import { describe, expect, it } from "vite-plus/test";

import {
  ANONYMOUS_DISTINCT_ID_PREFIX,
  buildAnalyticsWriterPlan,
  buildDlqEvent,
  computeCutoffIso,
  extractInnerProperties,
  extractPreviousDistinctId,
  makeCapturedEventFromInternalAnalyticsEvent,
  makeSnapshotResources,
  parsePersonTraits,
  sanitizeIdentifier,
  toClickhouseTimestamp,
  toFlag,
  toPendingOverrideRow,
  toPersonIdentityRow,
  toPersonRow,
  toProcessedEventRow,
  validateBuiltInProcessorRules,
  type AnalyticsWriterMessageType,
  type CapturedEventV1Type,
  type EventProcessorDlqV1,
  type ProcessedEventV2Type,
  type ProcessorPersonEventV1Type,
  type ProcessorPersonIdentityEventV1Type,
} from "../../../src/domain/analyticsIngest/AnalyticsIngest.ts";
import { REVENUE_TRUSTED_SOURCE_TOPIC } from "../../../src/domain/internalAnalytics/InternalAnalyticsEvents.ts";

// =============================================================================
// Fixtures — const-returning builders, one fresh object per test.
// =============================================================================

/**
 * A minimal valid {@link CapturedEventV1Type}. The two structural blocks that
 * the processor validation cares about — `routing` and `properties` — are
 * overridable; everything else is filler that keeps the shape type-valid.
 */
const capturedEvent = (
  overrides: {
    readonly event?: string;
    readonly distinctId?: string;
    readonly eventTimestamp?: string;
    readonly properties?: CapturedEventV1Type["properties"];
    readonly routing?: Partial<CapturedEventV1Type["routing"]>;
  } = {},
): CapturedEventV1Type => ({
  schemaVersion: 1,
  captureId: "cap_1",
  token: "tok_1",
  organizationId: "org_1",
  projectId: "proj_1",
  event: overrides.event ?? "page_view",
  distinctId: overrides.distinctId ?? "user_1",
  eventTimestamp: overrides.eventTimestamp ?? "2026-01-01T00:00:00.000Z",
  receivedAt: "2026-01-01T00:00:00.000Z",
  properties: overrides.properties ?? {},
  context: {},
  rawPayload: {},
  request: { requestId: "req_1" },
  routing: {
    routeClass: "main",
    targetTopic: "main.topic",
    isHistorical: false,
    skipEnrichment: false,
    ...overrides.routing,
  },
});

const processedEvent = (overrides: Partial<ProcessedEventV2Type> = {}): ProcessedEventV2Type => ({
  captureId: "cap_1",
  context: { ua: "test" },
  distinctId: "user_1",
  event: "page_view",
  eventTimestamp: "2026-01-01T12:34:56.789Z",
  groups: [],
  identity: { distinctId: "user_1", mode: "full", personId: "person_1" },
  organizationId: "org_1",
  processedAt: "2026-01-02T01:02:03.004Z",
  processedEventId: "ev_1",
  projectId: "proj_1",
  properties: { foo: "bar" },
  request: { requestId: "req_1", path: "/capture" },
  routing: {
    lane: "main",
    skipEnrichment: false,
    sourceOffset: "42",
    sourcePartition: 3,
    sourceTopic: "main.topic",
  },
  schemaVersion: 2,
  token: "tok_1",
  ...overrides,
});

const personEvent = (
  overrides: Partial<ProcessorPersonEventV1Type> = {},
): ProcessorPersonEventV1Type => ({
  changedAt: "2026-01-01T00:00:00.000Z",
  personId: "person_1",
  isArchived: false,
  projectId: "proj_1",
  schemaVersion: 1,
  traits: { plan: "pro" },
  version: 5,
  ...overrides,
});

const personIdentityEvent = (
  overrides: Partial<ProcessorPersonIdentityEventV1Type> = {},
): ProcessorPersonIdentityEventV1Type => ({
  changedAt: "2026-01-01T00:00:00.000Z",
  personId: "person_1",
  distinctId: "user_1",
  isDeleted: false,
  projectId: "proj_1",
  schemaVersion: 1,
  version: 1,
  ...overrides,
});

const dlqInput = (
  overrides: Partial<Omit<EventProcessorDlqV1, "failedAt" | "failureId" | "schemaVersion">> = {},
): Omit<EventProcessorDlqV1, "failedAt" | "failureId" | "schemaVersion"> => ({
  failureClass: "schema_rejected",
  failureMessage: "boom",
  headers: { "x-foo": "bar" },
  lane: "main",
  sourceOffset: "7",
  sourcePartition: 1,
  sourceTopic: "main.topic",
  ...overrides,
});

// =============================================================================
// parsePersonTraits
// =============================================================================

describe("parsePersonTraits", () => {
  it("returns empty set and setOnce for empty properties", () => {
    const result = parsePersonTraits({});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.set).toEqual({});
    expect(result.value.setOnce).toEqual({});
  });

  it("parses a $set object", () => {
    const result = parsePersonTraits({ $set: { plan: "pro" } });
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.set).toEqual({ plan: "pro" });
    expect(result.value.setOnce).toEqual({});
  });

  it("parses a $set_once object", () => {
    const result = parsePersonTraits({ $set_once: { firstSeen: "today" } });
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.setOnce).toEqual({ firstSeen: "today" });
    expect(result.value.set).toEqual({});
  });

  it("parses both $set and $set_once", () => {
    const result = parsePersonTraits({
      $set: { plan: "pro" },
      $set_once: { firstSeen: "today" },
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.set).toEqual({ plan: "pro" });
    expect(result.value.setOnce).toEqual({ firstSeen: "today" });
  });

  it("rejects a non-object $set", () => {
    const result = parsePersonTraits({ $set: "nope" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.message).toBe("$set must be an object");
  });

  it("rejects a non-object $set_once", () => {
    const result = parsePersonTraits({ $set_once: ["nope"] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.message).toBe("$set_once must be an object");
  });
});

// =============================================================================
// extractInnerProperties
// =============================================================================

describe("extractInnerProperties", () => {
  it("extracts a nested 'properties' object", () => {
    const inner = { a: 1 };
    expect(extractInnerProperties({ properties: inner, outer: 2 })).toBe(inner);
  });

  it("returns the input when 'properties' is missing", () => {
    const input = { a: 1 };
    expect(extractInnerProperties(input)).toBe(input);
  });

  it("returns the input when 'properties' is not an object", () => {
    const input = { properties: "string" };
    expect(extractInnerProperties(input)).toBe(input);
  });

  it("returns the input when 'properties' is an array (not a plain record)", () => {
    const input = { properties: [1, 2, 3] };
    expect(extractInnerProperties(input)).toBe(input);
  });
});

// =============================================================================
// validateBuiltInProcessorRules
// =============================================================================

describe("validateBuiltInProcessorRules", () => {
  const now = new Date("2026-01-10T00:00:00.000Z");

  it("accepts a valid main-lane event", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ routing: { targetTopic: "main.topic" } }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBeUndefined();
  });

  it("rejects when the routing target does not match the source topic", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ routing: { targetTopic: "other.topic" } }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("captured event routing target does not match source topic");
  });

  it("rejects a historical-lane event not marked isHistorical", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        routing: { targetTopic: "main.topic", isHistorical: false },
      }),
      historicalMinAgeHours: 24,
      lane: "historical",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("historical topic requires isHistorical=true");
  });

  it("rejects a main-lane event marked as historical", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        routing: { targetTopic: "main.topic", isHistorical: true },
      }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("non-historical lane received a historical captured event");
  });

  it("accepts a historical event older than the minimum age", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        // 48h before `now`, minimum age 24h → old enough.
        eventTimestamp: "2026-01-08T00:00:00.000Z",
        routing: { targetTopic: "main.topic", isHistorical: true },
      }),
      historicalMinAgeHours: 24,
      lane: "historical",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBeUndefined();
  });

  it("rejects a historical event newer than the minimum age", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        // 1h before `now`, minimum age 24h → too new.
        eventTimestamp: "2026-01-09T23:00:00.000Z",
        routing: { targetTopic: "main.topic", isHistorical: true },
      }),
      historicalMinAgeHours: 24,
      lane: "historical",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("historical event is newer than the configured minimum age");
  });

  it("rejects a non-object $set in properties", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ properties: { $set: "nope" } }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$set must be an object");
  });

  it("rejects a non-object $set_once in properties", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ properties: { $set_once: 42 } }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$set_once must be an object");
  });

  it("rejects a non-boolean $process_person_profile", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ properties: { $process_person_profile: "yes" } }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$process_person_profile must be a boolean");
  });

  it("rejects an $identify without $previous_distinct_id", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({ event: "$identify", properties: {} }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$identify requires properties.$previous_distinct_id");
  });

  it("rejects an $identify with an empty $previous_distinct_id", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        event: "$identify",
        properties: { $previous_distinct_id: "" },
      }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$identify requires properties.$previous_distinct_id");
  });

  it("rejects an $identify whose target distinct id uses the anonymous prefix", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        event: "$identify",
        distinctId: `${ANONYMOUS_DISTINCT_ID_PREFIX}abc`,
        properties: { $previous_distinct_id: "prev_1" },
      }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBe("$identify target distinct id cannot use the anonymous prefix");
  });

  it("accepts a valid $identify (previous id present, non-anonymous target)", () => {
    const result = validateBuiltInProcessorRules({
      capturedEvent: capturedEvent({
        event: "$identify",
        distinctId: "user_1",
        properties: { $previous_distinct_id: "prev_1" },
      }),
      historicalMinAgeHours: 24,
      lane: "main",
      now,
      sourceTopic: "main.topic",
    });
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// buildDlqEvent
// =============================================================================

describe("buildDlqEvent", () => {
  it("stamps a failedAt ISO timestamp and a schemaVersion of 1", () => {
    const event = buildDlqEvent(dlqInput());
    expect(event.schemaVersion).toBe(1);
    // failedAt round-trips through Date without losing precision.
    expect(new Date(event.failedAt).toISOString()).toBe(event.failedAt);
  });

  it("generates a unique UUID failureId per call", () => {
    const a = buildDlqEvent(dlqInput());
    const b = buildDlqEvent(dlqInput());
    expect(a.failureId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(a.failureId).not.toBe(b.failureId);
  });

  it("includes the optional fields when provided", () => {
    const event = buildDlqEvent(
      dlqInput({
        captureId: "cap_x",
        distinctId: "user_x",
        projectId: "proj_x",
        rawKey: "key_x",
        rawValue: "value_x",
        token: "tok_x",
      }),
    );
    expect(event.captureId).toBe("cap_x");
    expect(event.distinctId).toBe("user_x");
    expect(event.projectId).toBe("proj_x");
    expect(event.rawKey).toBe("key_x");
    expect(event.rawValue).toBe("value_x");
    expect(event.token).toBe("tok_x");
  });

  it("omits the optional fields when not provided", () => {
    const event = buildDlqEvent(dlqInput());
    expect("captureId" in event).toBe(false);
    expect("distinctId" in event).toBe(false);
    expect("projectId" in event).toBe(false);
    expect("rawKey" in event).toBe(false);
    expect("rawValue" in event).toBe(false);
    expect("token" in event).toBe(false);
  });

  it("carries the non-optional fields straight through", () => {
    const event = buildDlqEvent(dlqInput({ failureClass: "policy_rejected" }));
    expect(event.failureClass).toBe("policy_rejected");
    expect(event.failureMessage).toBe("boom");
    expect(event.headers).toEqual({ "x-foo": "bar" });
    expect(event.lane).toBe("main");
    expect(event.sourceOffset).toBe("7");
    expect(event.sourcePartition).toBe(1);
    expect(event.sourceTopic).toBe("main.topic");
  });
});

// =============================================================================
// toFlag / toClickhouseTimestamp / extractPreviousDistinctId
// =============================================================================

describe("toFlag", () => {
  it("converts true to 1", () => {
    expect(toFlag(true)).toBe(1);
  });

  it("converts false to 0", () => {
    expect(toFlag(false)).toBe(0);
  });
});

describe("toClickhouseTimestamp", () => {
  it("converts an ISO string to ClickHouse 'YYYY-MM-DD HH:MM:SS.mmm' UTC format", () => {
    expect(toClickhouseTimestamp("2026-01-02T03:04:05.006Z")).toBe("2026-01-02 03:04:05.006");
  });

  it("zero-pads each part", () => {
    expect(toClickhouseTimestamp("2026-09-09T09:09:09.009Z")).toBe("2026-09-09 09:09:09.009");
  });

  it("throws on an invalid timestamp", () => {
    expect(() => toClickhouseTimestamp("not-a-date")).toThrow("Invalid timestamp: not-a-date");
  });
});

describe("extractPreviousDistinctId", () => {
  it("extracts from a nested $previous_distinct_id property", () => {
    const event = processedEvent({ properties: { $previous_distinct_id: "prev_1" } });
    expect(extractPreviousDistinctId(event)).toBe("prev_1");
  });

  it("extracts from a doubly-nested properties wrapper", () => {
    const event = processedEvent({
      properties: { properties: { $previous_distinct_id: "prev_2" } },
    });
    expect(extractPreviousDistinctId(event)).toBe("prev_2");
  });

  it("returns null when the field is missing", () => {
    const event = processedEvent({ properties: { other: 1 } });
    expect(extractPreviousDistinctId(event)).toBeNull();
  });

  it("returns null for an empty / whitespace-only string", () => {
    const event = processedEvent({ properties: { $previous_distinct_id: "   " } });
    expect(extractPreviousDistinctId(event)).toBeNull();
  });
});

// =============================================================================
// Row builders
// =============================================================================

describe("toProcessedEventRow", () => {
  it("converts a ProcessedEventV2 to the ClickHouse row shape", () => {
    const row = toProcessedEventRow(processedEvent());
    expect(row).toMatchObject({
      capture_id: "cap_1",
      distinct_id: "user_1",
      event_id: "ev_1",
      event_name: "page_view",
      event_ts: "2026-01-01 12:34:56.789",
      identity_mode: "full",
      organization_id: "org_1",
      person_id: "person_1",
      processed_ts: "2026-01-02 01:02:03.004",
      project_id: "proj_1",
      request_id: "req_1",
      request_path: "/capture",
      route_lane: "main",
      schema_version: 2,
      skip_enrichment: 0,
      source_offset: "42",
      source_partition: 3,
      source_topic: "main.topic",
      token: "tok_1",
    });
  });

  it("serializes context and properties as JSON strings", () => {
    const row = toProcessedEventRow(
      processedEvent({ context: { ua: "x" }, properties: { foo: "bar" } }),
    );
    expect(row.context).toBe(JSON.stringify({ ua: "x" }));
    expect(row.event_properties).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("maps a missing person_id to null", () => {
    const row = toProcessedEventRow(
      processedEvent({ identity: { distinctId: "user_1", mode: "personless" } }),
    );
    expect(row.person_id).toBeNull();
    expect(row.identity_mode).toBe("personless");
  });

  it("defaults request_path to an empty string when absent", () => {
    const row = toProcessedEventRow(processedEvent({ request: { requestId: "req_1" } }));
    expect(row.request_path).toBe("");
  });

  it("sets skip_enrichment to 1 when enrichment is skipped", () => {
    const row = toProcessedEventRow(
      processedEvent({
        routing: {
          lane: "main",
          skipEnrichment: true,
          sourceOffset: "1",
          sourcePartition: 0,
          sourceTopic: "main.topic",
        },
      }),
    );
    expect(row.skip_enrichment).toBe(1);
  });
});

describe("toPersonRow", () => {
  it("converts a person event to a row carrying the supplied organization_id", () => {
    const row = toPersonRow(personEvent(), "org_resolved");
    expect(row).toMatchObject({
      changed_at: "2026-01-01 00:00:00.000",
      organization_id: "org_resolved",
      person_id: "person_1",
      email: null,
      is_archived: 0,
      merged_into_person_id: null,
      name: null,
      primary_distinct_id: null,
      project_id: "proj_1",
      version: 5,
    });
  });

  it("encodes traits as a JSON string", () => {
    const row = toPersonRow(personEvent({ traits: { plan: "pro" } }), "org_1");
    expect(row.traits).toBe(JSON.stringify({ plan: "pro" }));
  });

  it("flags archival and surfaces optional string fields", () => {
    const row = toPersonRow(
      personEvent({
        isArchived: true,
        email: "a@b.com",
        name: "Ada",
        primaryDistinctId: "user_1",
        mergedIntoPersonId: "person_2",
      }),
      "org_1",
    );
    expect(row.is_archived).toBe(1);
    expect(row.email).toBe("a@b.com");
    expect(row.name).toBe("Ada");
    expect(row.primary_distinct_id).toBe("user_1");
    expect(row.merged_into_person_id).toBe("person_2");
  });
});

describe("toPersonIdentityRow", () => {
  it("converts an identity event to a row", () => {
    const row = toPersonIdentityRow(
      personIdentityEvent({ previousDistinctId: "prev_1", isDeleted: true, version: 3 }),
      "org_resolved",
    );
    expect(row).toMatchObject({
      changed_at: "2026-01-01 00:00:00.000",
      organization_id: "org_resolved",
      person_id: "person_1",
      distinct_id: "user_1",
      is_deleted: 1,
      previous_distinct_id: "prev_1",
      project_id: "proj_1",
      version: 3,
    });
  });

  it("maps an absent previous distinct id to null", () => {
    const row = toPersonIdentityRow(personIdentityEvent(), "org_1");
    expect(row.previous_distinct_id).toBeNull();
  });
});

describe("toPendingOverrideRow", () => {
  it("builds the pending override with source and target distinct ids", () => {
    const row = toPendingOverrideRow(
      personIdentityEvent({ previousDistinctId: "prev_1", distinctId: "user_1", version: 2 }),
      "org_resolved",
    );
    expect(row).toMatchObject({
      changed_at: "2026-01-01 00:00:00.000",
      organization_id: "org_resolved",
      person_id: "person_1",
      is_deleted: 0,
      project_id: "proj_1",
      source_distinct_id: "prev_1",
      target_distinct_id: "user_1",
      version: 2,
    });
  });

  it("defaults the source distinct id to an empty string when absent", () => {
    const row = toPendingOverrideRow(personIdentityEvent(), "org_1");
    expect(row.source_distinct_id).toBe("");
  });
});

// =============================================================================
// buildAnalyticsWriterPlan
// =============================================================================

describe("buildAnalyticsWriterPlan", () => {
  const resolveOrg = (projectId: string) => `org_for_${projectId}`;

  it("separates processed, person and identity messages into their lanes", () => {
    const messages: ReadonlyArray<AnalyticsWriterMessageType> = [
      { kind: "processed", messageId: "m1", value: processedEvent() },
      { kind: "person", messageId: "m2", value: personEvent() },
      {
        kind: "person-distinct-id",
        messageId: "m3",
        // version 0 + no previousDistinctId → no override rows.
        value: personIdentityEvent({ version: 0 }),
      },
    ];
    const plan = buildAnalyticsWriterPlan(messages, resolveOrg);
    expect(plan.processedEventRows).toHaveLength(1);
    expect(plan.personRows).toHaveLength(1);
    expect(plan.personIdentityRows).toHaveLength(1);
    expect(plan.personIdentityOverrideRows).toHaveLength(0);
    expect(plan.personIdentityPendingOverrideRows).toHaveLength(0);
  });

  it("emits override + pending-override rows for a versioned identity change with a previous id", () => {
    const messages: ReadonlyArray<AnalyticsWriterMessageType> = [
      {
        kind: "person-distinct-id",
        messageId: "m1",
        value: personIdentityEvent({ previousDistinctId: "prev_1", version: 1 }),
      },
    ];
    const plan = buildAnalyticsWriterPlan(messages, resolveOrg);
    expect(plan.personIdentityRows).toHaveLength(1);
    expect(plan.personIdentityOverrideRows).toHaveLength(1);
    expect(plan.personIdentityPendingOverrideRows).toHaveLength(1);
    expect(plan.personIdentityPendingOverrideRows[0]).toMatchObject({
      source_distinct_id: "prev_1",
      target_distinct_id: "user_1",
    });
  });

  it("does not emit override rows when version is 0 even with a previous id", () => {
    const messages: ReadonlyArray<AnalyticsWriterMessageType> = [
      {
        kind: "person-distinct-id",
        messageId: "m1",
        value: personIdentityEvent({ previousDistinctId: "prev_1", version: 0 }),
      },
    ];
    const plan = buildAnalyticsWriterPlan(messages, resolveOrg);
    expect(plan.personIdentityOverrideRows).toHaveLength(0);
    expect(plan.personIdentityPendingOverrideRows).toHaveLength(0);
  });

  it("resolves the organization id via the callback for person and identity rows", () => {
    const messages: ReadonlyArray<AnalyticsWriterMessageType> = [
      { kind: "person", messageId: "m1", value: personEvent({ projectId: "proj_z" }) },
      {
        kind: "person-distinct-id",
        messageId: "m2",
        value: personIdentityEvent({ projectId: "proj_z" }),
      },
    ];
    const plan = buildAnalyticsWriterPlan(messages, resolveOrg);
    expect(plan.personRows[0]?.organization_id).toBe("org_for_proj_z");
    expect(plan.personIdentityRows[0]?.organization_id).toBe("org_for_proj_z");
  });

  it("returns all-empty lanes for an empty message list", () => {
    const plan = buildAnalyticsWriterPlan([], resolveOrg);
    expect(plan.processedEventRows).toHaveLength(0);
    expect(plan.personRows).toHaveLength(0);
    expect(plan.personIdentityRows).toHaveLength(0);
    expect(plan.personIdentityOverrideRows).toHaveLength(0);
    expect(plan.personIdentityPendingOverrideRows).toHaveLength(0);
  });
});

// =============================================================================
// makeCapturedEventFromInternalAnalyticsEvent
// =============================================================================

describe("makeCapturedEventFromInternalAnalyticsEvent", () => {
  it("maps a trusted revenue event onto a CapturedEventV1 with a Resolved claim", () => {
    const occurredAt = new Date("2026-03-04T05:06:07.008Z");
    const captured = makeCapturedEventFromInternalAnalyticsEvent({
      eventName: "$purchase.completed",
      eventId: "an_evt_k1:_purchase.completed:person_1",
      distinctId: "dist_1",
      occurredAt,
      organizationId: "org_1",
      personId: "person_1",
      projectId: "proj_1",
      token: "tok_1",
      transactionId: "txn_1",
      context: { sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC },
      properties: {
        paymentProviderConfigurationId: "cfg_1",
        paymentProviderConfigurationProductId: "prod_1",
        providerEnvironment: 1,
        providerEventType: "PURCHASE",
        providerId: "appstore",
        providerSubscriptionId: null,
        providerTransactionId: null,
        providerWebhookNotificationId: null,
        source: "appstore",
        grossAmountUsd: 1_100,
      },
    });

    expect(captured.schemaVersion).toBe(1);
    // The deterministic id rides as clientEventId → becomes events_v2.event_id.
    expect(captured.clientEventId).toBe("an_evt_k1:_purchase.completed:person_1");
    expect(captured.captureId).toBe("internal_an_evt_k1:_purchase.completed:person_1");
    expect(captured.event).toBe("$purchase.completed");
    expect(captured.distinctId).toBe("dist_1");
    expect(captured.organizationId).toBe("org_1");
    expect(captured.projectId).toBe("proj_1");
    expect(captured.token).toBe("tok_1");
    expect(captured.eventTimestamp).toBe(occurredAt.toISOString());
    // Server-trusted: Resolved claim + trusted topic + skipEnrichment.
    expect(captured.identityClaim).toEqual({
      _tag: "Resolved",
      distinctId: "dist_1",
      personId: "person_1",
    });
    expect(captured.trustClass).toBe("trusted-revenue");
    expect(captured.routing.targetTopic).toBe(REVENUE_TRUSTED_SOURCE_TOPIC);
    expect(captured.routing.skipEnrichment).toBe(true);
    expect(captured.routing.isHistorical).toBe(false);
    expect(captured.routing.routeClass).toBe("main");
  });

  it("coerces Date-valued properties to ISO strings so the envelope is JSON-clean", () => {
    const transferredAt = new Date("2026-03-04T05:06:07.008Z");
    const captured = makeCapturedEventFromInternalAnalyticsEvent({
      eventName: "$subscription.transferred_in",
      eventId: "an_evt_kx:_subscription.transferred_in:person_to",
      distinctId: "dist_to",
      occurredAt: transferredAt,
      organizationId: "org_1",
      personId: "person_to",
      projectId: "proj_1",
      token: "tok_1",
      transactionId: null,
      properties: {
        paymentProviderConfigurationId: "cfg_1",
        paymentProviderConfigurationProductId: "prod_1",
        providerEnvironment: 1,
        providerId: "appstore",
        source: "appstore",
        providerEventType: "subscription.transferred",
        subscriptionId: "sub_1",
        fromDistinctId: "dist_from",
        fromPersonId: "person_from",
        toDistinctId: "dist_to",
        toPersonId: "person_to",
        transferMode: "transfer_to_new_owner",
        transferReason: "appstore_restore",
        transferredAt,
      },
    });
    // The Date becomes its ISO string — no live Date object survives onto the
    // wire `properties` (which permits only JSON primitives).
    expect(captured.properties.transferredAt).toBe(transferredAt.toISOString());
    expect(JSON.parse(JSON.stringify(captured)).properties.transferredAt).toBe(
      transferredAt.toISOString(),
    );
  });
});

// =============================================================================
// Janitor snapshot helpers
// =============================================================================

describe("sanitizeIdentifier", () => {
  it("replaces non-alphanumeric characters with underscores", () => {
    expect(sanitizeIdentifier("a-b.c d")).toBe("a_b_c_d");
  });

  it("keeps valid alphanumeric and underscore characters", () => {
    expect(sanitizeIdentifier("Abc_123")).toBe("Abc_123");
  });
});

describe("makeSnapshotResources", () => {
  it("generates deterministic, dash-stripped names from a supplied runId", () => {
    const resources = makeSnapshotResources("run-12-34");
    expect(resources.pendingOverrideSnapshotName).toBe(
      "person_identity_pending_override_snapshot_run1234",
    );
    expect(resources.pendingOverrideDictionaryName).toBe(
      "person_identity_pending_override_dict_run1234",
    );
  });

  it("generates unique names across calls when no runId is supplied (UUID default)", () => {
    const a = makeSnapshotResources();
    const b = makeSnapshotResources();
    expect(a.pendingOverrideSnapshotName).not.toBe(b.pendingOverrideSnapshotName);
    // The generated suffix must be a safe SQL identifier (no dashes / specials).
    expect(a.pendingOverrideSnapshotName).toMatch(/^[a-zA-Z0-9_]+$/);
  });
});

describe("computeCutoffIso", () => {
  it("subtracts the safety window from now", () => {
    const now = new Date("2026-01-01T00:00:10.000Z");
    expect(computeCutoffIso({ now, safetyWindowSeconds: 10 })).toBe("2026-01-01T00:00:00.000Z");
  });

  it("treats a zero window as 'now'", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(computeCutoffIso({ now, safetyWindowSeconds: 0 })).toBe(now.toISOString());
  });
});
