import { DateTime, Effect, Schema } from "effect";

import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { constant } from "@voidhash/lib/lang";

import type {
  CapturedEventV1Type,
  CapturedTransportRecord,
  ProcessingEvent,
  ProcessorProjectPolicy,
  ResolvedProcessorProject,
} from "../../../src/domain/analyticsIngest/AnalyticsIngest.ts";
import type {
  PersonIdentityEventV1,
  PersonSnapshotEventV1,
} from "../../../src/services/personIdentity/PersonIdentityService.ts";
import {
  attachProjectPolicy,
  buildPersonIdentityCall,
  buildProcessedEvent,
  toProcessorPersonEvent,
  toProcessorPersonIdentityEvents,
} from "../../../src/services/analyticsIngest/EventProcessorService.ts";
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const PROJECT_ID = "prj_test";
const ORG_ID = "org_test";
const TOKEN = "tok_test";
const SOURCE_TOPIC = "analytics.main";
const EVENT_TS = "2026-01-01T00:00:00.000Z";

/** Fresh captured-event builder — one object per test, no shared mutable state. */
const capturedEvent = (overrides: Partial<CapturedEventV1Type> = {}): CapturedEventV1Type => ({
  schemaVersion: 1,
  captureId: "cap_1",
  token: TOKEN,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  event: "page_view",
  distinctId: "user_1",
  eventTimestamp: EVENT_TS,
  receivedAt: EVENT_TS,
  properties: {},
  context: {},
  rawPayload: {},
  request: { requestId: "req_1" },
  routing: {
    routeClass: "main",
    targetTopic: SOURCE_TOPIC,
    isHistorical: false,
    skipEnrichment: false,
  },
  ...overrides,
});

/** Fresh transport-record builder wrapping a captured event. */
const transportRecord = (
  overrides: Partial<CapturedTransportRecord> = {},
): CapturedTransportRecord => ({
  capturedEvent: overrides.capturedEvent ?? capturedEvent(),
  headers: {},
  lane: "main",
  rawValue: encodeJson(overrides.capturedEvent ?? capturedEvent()),
  sourceOffset: "off_1",
  sourcePartition: 0,
  sourceTopic: SOURCE_TOPIC,
  ...overrides,
});

/** Fresh processor-project-policy builder; permissive by default. */
const policy = (overrides: Partial<ProcessorProjectPolicy> = {}): ProcessorProjectPolicy => ({
  processorAllowHistorical: true,
  processorAllowOverflow: true,
  processorEnabled: true,
  processorHistoricalMinAgeHours: 24,
  processorPersonProcessingEnabled: true,
  processorSchemaMode: "lenient",
  ...overrides,
});

/** Fresh resolved-project builder matching the default captured-event projectId. */
const resolvedProject = (
  overrides: Partial<ResolvedProcessorProject> = {},
): ResolvedProcessorProject => ({
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  policy: policy(overrides.policy),
  ...overrides,
});

/** Fresh processing-event builder — drives buildPersonIdentityCall. */
const processingEvent = (overrides: Partial<ProcessingEvent> = {}): ProcessingEvent => ({
  capturedEvent: overrides.capturedEvent ?? capturedEvent(),
  headers: {},
  identityKey: `${TOKEN}:user_1`,
  lane: "main",
  projectPolicy: policy(overrides.projectPolicy),
  rawValue: "{}",
  sourceOffset: "off_1",
  sourcePartition: 0,
  sourceTopic: SOURCE_TOPIC,
  ...overrides,
});

const NOW = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

describe("attachProjectPolicy", () => {
  it("returns ok:true with a ProcessingEvent when every validation passes", () => {
    const record = transportRecord();
    const result = attachProjectPolicy({ now: NOW, record, resolvedProject: resolvedProject() });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.capturedEvent).toBe(record.capturedEvent);
      expect(result.value.lane).toBe("main");
      expect(result.value.sourceTopic).toBe(SOURCE_TOPIC);
      expect(result.value.projectPolicy.processorEnabled).toBe(true);
    }
  });

  it("sets identityKey as `${token}:${distinctId}` on the success value", () => {
    const record = transportRecord({
      capturedEvent: capturedEvent({ distinctId: "user_99", token: "tok_abc" }),
    });
    const result = attachProjectPolicy({ now: NOW, record, resolvedProject: resolvedProject() });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identityKey).toBe("tok_abc:user_99");
    }
  });

  it("rejects with a project_not_found DLQ event when the resolved project id does not match", () => {
    const record = transportRecord();
    const result = attachProjectPolicy({
      now: NOW,
      record,
      resolvedProject: resolvedProject({ projectId: "prj_other" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.failureClass).toBe("project_not_found");
      expect(result.value.projectId).toBe(PROJECT_ID);
    }
  });

  it("rejects with a policy_rejected DLQ event when the processor is disabled for the project", () => {
    const record = transportRecord();
    const result = attachProjectPolicy({
      now: NOW,
      record,
      resolvedProject: resolvedProject({ policy: policy({ processorEnabled: false }) }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.failureClass).toBe("policy_rejected");
      expect(result.value.failureMessage).toContain("disabled");
    }
  });

  it("rejects the overflow lane when processorAllowOverflow is false", () => {
    const record = transportRecord({ lane: "overflow" });
    const result = attachProjectPolicy({
      now: NOW,
      record,
      resolvedProject: resolvedProject({ policy: policy({ processorAllowOverflow: false }) }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.failureClass).toBe("policy_rejected");
      expect(result.value.failureMessage).toContain("overflow");
    }
  });

  it("allows the overflow lane when processorAllowOverflow is true", () => {
    const record = transportRecord({ lane: "overflow" });
    const result = attachProjectPolicy({
      now: NOW,
      record,
      resolvedProject: resolvedProject({ policy: policy({ processorAllowOverflow: true }) }),
    });

    expect(result.ok).toBe(true);
  });

  it("rejects the historical lane when processorAllowHistorical is false", () => {
    // A well-formed historical record requires isHistorical=true and an event old
    // enough to clear the min-age gate, so the lane check is what trips first.
    const oldTimestamp = DateTime.formatIso(
      DateTime.makeUnsafe(NOW.getTime() - 48 * 60 * 60 * 1000),
    );
    const record = transportRecord({
      capturedEvent: capturedEvent({
        eventTimestamp: oldTimestamp,
        routing: {
          routeClass: "historical",
          targetTopic: SOURCE_TOPIC,
          isHistorical: true,
          skipEnrichment: false,
        },
      }),
      lane: "historical",
    });
    const result = attachProjectPolicy({
      now: NOW,
      record,
      resolvedProject: resolvedProject({ policy: policy({ processorAllowHistorical: false }) }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.failureClass).toBe("policy_rejected");
      expect(result.value.failureMessage).toContain("historical");
    }
  });

  it("rejects with a schema_rejected DLQ event when validateBuiltInProcessorRules fails", () => {
    // routing.targetTopic mismatching the source topic is the first built-in rule.
    const record = transportRecord({
      capturedEvent: capturedEvent({
        routing: {
          routeClass: "main",
          targetTopic: "some.other.topic",
          isHistorical: false,
          skipEnrichment: false,
        },
      }),
    });
    const result = attachProjectPolicy({ now: NOW, record, resolvedProject: resolvedProject() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.failureClass).toBe("schema_rejected");
    }
  });
});

describe("buildPersonIdentityCall", () => {
  it.effect("returns kind:'identify' when the event is $identify", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            event: "$identify",
            distinctId: "identified_user",
            properties: { $previous_distinct_id: "anon_123" },
          }),
        }),
      );

      expect(call.kind).toBe("identify");
      if (call.kind === "identify") {
        expect(call.input.distinctId).toBe("identified_user");
        expect(call.input.projectId).toBe(PROJECT_ID);
        expect(call.input.eventTimestamp).toEqual(
          DateTime.toDateUtc(DateTime.makeUnsafe(EVENT_TS)),
        );
      }
    }),
  );

  it.effect("includes previousDistinctId from $previous_distinct_id for $identify", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            event: "$identify",
            properties: { $previous_distinct_id: "anon_prev" },
          }),
        }),
      );

      expect(call.kind).toBe("identify");
      if (call.kind === "identify") {
        expect(call.input.previousDistinctId).toBe("anon_prev");
      }
    }),
  );

  it.effect("fails when $identify is missing $previous_distinct_id", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        buildPersonIdentityCall(
          processingEvent({
            capturedEvent: capturedEvent({ event: "$identify", properties: {} }),
          }),
        ),
      );

      expect(error.message).toContain("$previous_distinct_id");
    }),
  );

  it.effect("returns kind:'resolve' for non-$identify events", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({ capturedEvent: capturedEvent({ event: "page_view" }) }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.distinctId).toBe("user_1");
        expect(call.input.projectId).toBe(PROJECT_ID);
      }
    }),
  );

  it.effect("parses name/email and set/setOnce attributes from $set and $set_once", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            properties: {
              $set: { name: "Ada", plan: "pro" },
              $set_once: { email: "ada@example.com", signup_source: "web" },
            },
          }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.name).toBe("Ada");
        expect(call.input.email).toBe("ada@example.com");
        expect(call.input.setAttributes).toEqual({ plan: "pro" });
        expect(call.input.setOnceAttributes).toEqual({ signup_source: "web" });
      }
    }),
  );

  it.effect("excludes name and email from setAttributes and setOnceAttributes", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            properties: {
              $set: { name: "Ada", email: "a@b.co", plan: "pro" },
              $set_once: { name: "Once", email: "x@y.co", region: "eu" },
            },
          }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.setAttributes).not.toHaveProperty("name");
        expect(call.input.setAttributes).not.toHaveProperty("email");
        expect(call.input.setOnceAttributes).not.toHaveProperty("name");
        expect(call.input.setOnceAttributes).not.toHaveProperty("email");
        expect(call.input.setAttributes).toEqual({ plan: "pro" });
        expect(call.input.setOnceAttributes).toEqual({ region: "eu" });
      }
    }),
  );

  it.effect("reads traits from a nested `properties.properties` envelope", () =>
    Effect.gen(function* () {
      // extractInnerProperties unwraps one level when properties.properties is a plain object.
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            properties: { properties: { $set: { name: "Inner" } } },
          }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.name).toBe("Inner");
      }
    }),
  );

  it.effect("defaults shouldCreatePerson to false for an anonymous distinct id", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({ distinctId: `${ANONYMOUS_USER_ID_PREFIX}abc` }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.shouldCreatePerson).toBe(false);
      }
    }),
  );

  it.effect("defaults shouldCreatePerson to true for a non-anonymous distinct id", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({ capturedEvent: capturedEvent({ distinctId: "real_user" }) }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.shouldCreatePerson).toBe(true);
      }
    }),
  );

  it.effect("honors an explicit $process_person_profile over the distinct-id default", () =>
    Effect.gen(function* () {
      // Anonymous id would default to false, but the explicit flag wins.
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            distinctId: `${ANONYMOUS_USER_ID_PREFIX}abc`,
            properties: { $process_person_profile: true },
          }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.shouldCreatePerson).toBe(true);
      }
    }),
  );

  it.effect("empties enrichment attributes when routing.skipEnrichment is true", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            properties: { $set: { plan: "pro" }, $set_once: { region: "eu" } },
            routing: {
              routeClass: "main",
              targetTopic: SOURCE_TOPIC,
              isHistorical: false,
              skipEnrichment: true,
            },
          }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.setAttributes).toEqual({});
        expect(call.input.setOnceAttributes).toEqual({});
      }
    }),
  );

  it.effect("empties enrichment attributes when processorPersonProcessingEnabled is false", () =>
    Effect.gen(function* () {
      const call = yield* buildPersonIdentityCall(
        processingEvent({
          capturedEvent: capturedEvent({
            properties: { $set: { plan: "pro" }, $set_once: { region: "eu" } },
          }),
          projectPolicy: policy({ processorPersonProcessingEnabled: false }),
        }),
      );

      expect(call.kind).toBe("resolve");
      if (call.kind === "resolve") {
        expect(call.input.setAttributes).toEqual({});
        expect(call.input.setOnceAttributes).toEqual({});
      }
    }),
  );

  it.effect("fails when $set is present but not an object (parsePersonTraits failure)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        buildPersonIdentityCall(
          processingEvent({
            capturedEvent: capturedEvent({ properties: { $set: "not-an-object" } }),
          }),
        ),
      );

      expect(error.message).toContain("$set must be an object");
    }),
  );
});

describe("toProcessorPersonEvent", () => {
  /** Fresh person-snapshot builder. */
  const snapshot = (overrides: Partial<PersonSnapshotEventV1> = {}): PersonSnapshotEventV1 => ({
    changedAt: EVENT_TS,
    personId: "person_1",
    isArchived: false,
    projectId: PROJECT_ID,
    schemaVersion: 1,
    traits: { plan: "pro" },
    version: 3,
    ...overrides,
  });

  it("maps all snapshot fields, including the optional ones when present", () => {
    const event = toProcessorPersonEvent(
      snapshot({
        email: "a@b.co",
        mergedIntoPersonId: "person_2",
        name: "Ada",
        primaryDistinctId: "user_1",
      }),
    );

    expect(event).toEqual({
      changedAt: EVENT_TS,
      personId: "person_1",
      email: "a@b.co",
      isArchived: false,
      mergedIntoPersonId: "person_2",
      name: "Ada",
      primaryDistinctId: "user_1",
      projectId: PROJECT_ID,
      schemaVersion: 1,
      traits: { plan: "pro" },
      version: 3,
    });
  });

  it("omits email/mergedIntoPersonId/name/primaryDistinctId when absent", () => {
    const event = toProcessorPersonEvent(snapshot());

    expect(event).not.toHaveProperty("email");
    expect(event).not.toHaveProperty("mergedIntoPersonId");
    expect(event).not.toHaveProperty("name");
    expect(event).not.toHaveProperty("primaryDistinctId");
    expect(event.personId).toBe("person_1");
    expect(event.schemaVersion).toBe(1);
  });
});

describe("toProcessorPersonIdentityEvents", () => {
  /** Fresh mapping-event builder. */
  const mappingEvent = (overrides: Partial<PersonIdentityEventV1> = {}): PersonIdentityEventV1 => ({
    changedAt: EVENT_TS,
    personId: "person_1",
    distinctId: "user_1",
    isDeleted: false,
    kind: 2,
    projectId: PROJECT_ID,
    schemaVersion: 1,
    version: 2,
    ...overrides,
  });

  const identity = (distinctId: string) => ({
    distinctId,
    mode: constant("full"),
    personId: "person_1",
  });

  it("maps each mappingEvent to a ProcessorPersonIdentityEventV1", () => {
    const events = toProcessorPersonIdentityEvents({
      identity: identity("user_1"),
      mappingEvents: [mappingEvent(), mappingEvent({ distinctId: "user_1", version: 5 })],
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.personId).toBe("person_1");
    expect(events[0]?.projectId).toBe(PROJECT_ID);
    expect(events[1]?.version).toBe(5);
  });

  it("returns an empty array when there are no mapping events", () => {
    const events = toProcessorPersonIdentityEvents({
      identity: identity("user_1"),
      mappingEvents: [],
    });

    expect(events).toEqual([]);
  });

  it("omits previousDistinctId when mappingEvent.distinctId equals the identity distinctId", () => {
    const events = toProcessorPersonIdentityEvents({
      identity: identity("user_1"),
      mappingEvents: [mappingEvent({ distinctId: "user_1" })],
    });

    expect(events[0]).not.toHaveProperty("previousDistinctId");
    expect(events[0]?.distinctId).toBe("user_1");
  });

  it("sets previousDistinctId and rewrites distinctId when the mapping distinctId differs", () => {
    // When the mapping points at a different source id, the source becomes
    // previousDistinctId and the row's distinctId is the identity's canonical id.
    const events = toProcessorPersonIdentityEvents({
      identity: identity("canonical_user"),
      mappingEvents: [mappingEvent({ distinctId: "anon_source" })],
    });

    expect(events[0]?.previousDistinctId).toBe("anon_source");
    expect(events[0]?.distinctId).toBe("canonical_user");
  });
});

describe("buildProcessedEvent", () => {
  it("uses captureId as the deterministic processed event id when no client uuid", () => {
    const event = capturedEvent();
    const processed = buildProcessedEvent({
      capturedEvent: event,
      identity: { distinctId: event.distinctId, mode: "personless" },
      lane: "main",
      sourceOffset: "0",
      sourcePartition: 0,
      sourceTopic: event.routing.targetTopic,
    });

    expect(processed.processedEventId).toBe(event.captureId);
  });

  it("prefers the SDK clientEventId over captureId for the processed event id", () => {
    const event = capturedEvent({ clientEventId: "client_uuid" });
    const processed = buildProcessedEvent({
      capturedEvent: event,
      identity: { distinctId: event.distinctId, mode: "personless" },
      lane: "main",
      sourceOffset: "0",
      sourcePartition: 0,
      sourceTopic: event.routing.targetTopic,
    });

    expect(processed.processedEventId).toBe("client_uuid");
  });
});
