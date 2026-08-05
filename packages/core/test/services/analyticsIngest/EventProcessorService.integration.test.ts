/**
 * Integration tests for {@link EventProcessorService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB + ClickHouse + WorkOS; only the project schema cache is an
 * in-memory stub).
 *
 * `processRecordToOutputs` is a single-record orchestration: it resolves the
 * project + processor policy by token (real MySQL join over `api_key` →
 * `project` → `capture_project_policy`), validates policy/lane/schema rules,
 * runs identity resolution directly (order-agnostic; serialized at the row level
 * by the identity transaction's locks), and
 * returns the three downstream output streams. Each test drives the service
 * end-to-end and verifies the *persisted* side effect rather than just the
 * return value:
 *  - DLQ rejection paths write an `analytics_ingest_dlq` row with the right
 *    `failure_class` / `project_id` (verified by reading the row back) and
 *    return empty outputs.
 *  - the happy path writes the `person` + `person_identity` rows that identity
 *    resolution creates, and the returned `ProcessorOutputs` carry the matching
 *    processed / person / identity wire events.
 *
 * Conventions:
 *  - The fixture seeds only user/org/member/project. This service needs a
 *    *public* API key under the fixture project (the capture token) plus, for
 *    some cases, a `capture_project_policy` row; both are created per test with
 *    unique tokens and cleaned up via {@link withCleanup}.
 *  - Every record uses a unique `captureId` / `distinctId` so the unique index
 *    on `analytics_ingest_dlq.capture_id` never collides with a leftover row
 *    and assertions stay membership-based (by capture id / distinct id), never
 *    exact counts.
 *  - {@link withCleanup} deletes everything a test created (DLQ rows, persons,
 *    identity rows, policy rows, api keys, migration jobs) on exit, success or
 *    failure. The global teardown sweep is only a backstop.
 *  - The collaborators the service layer needs but the harness does not provide
 *    (`DlqProducer`, `PersonIdentityService`, and their
 *    transitive ports) are wired here from their real layers, so the only
 *    requirement reaching the harness is `Db` (plus the harness's own set).
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 */
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import type {
  CapturedEventV1Type,
  CapturedTransportRecord,
} from "@voidhash/core/domain/analyticsIngest/AnalyticsIngest";
import { EventProcessorService } from "@voidhash/core/services/analyticsIngest/EventProcessorService";
import { DlqProducer } from "@voidhash/core/services/analyticsIngest/DlqProducer";
import { AnalyticsIngestDlqService } from "@voidhash/core/services/analyticsIngest/AnalyticsIngestDlqService";
import { CaptureIngress } from "@voidhash/core/services/analyticsIngest/CaptureIngress";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { REVENUE_TRUSTED_SOURCE_TOPIC } from "@voidhash/core/domain/internalAnalytics/InternalAnalyticsEvents";
import {
  Db,
  analyticsIngestDlq,
  and,
  apiKeys,
  captureProjectPolicies,
  eq,
  inArray,
  personIdentities,
  persons,
  personPersonlessIdentities,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

/**
 * Compose the service-under-test layer together with the collaborators the
 * harness does not provide. After this layer, the only outstanding requirement
 * is `Db` (plus the harness's own services), satisfying `R extends
 * HarnessServices`. The DLQ + identity collaborators are the real layers so the
 * DB side effects they produce can be verified; external publication is wired
 * to its no-op variant.
 */
const TestLayer = EventProcessorService.layer.pipe(
  Layer.provide(DlqProducer.dbLive),
  Layer.provide(AnalyticsIngestDlqService.layer),
  Layer.provide(CaptureIngress.noop),
  Layer.provide(PersonIdentityService.layer),
  Layer.provide(IdentityProjectionPublisher.noop),
);

/** Monotonic counter so ids stay unique even within the same millisecond. */
let seq = 0;
const unique = (label: string) => `it-ep-${label}-${Date.now()}-${seq++}`;

interface RecordOverrides {
  readonly token: string;
  readonly distinctId?: string;
  readonly captureId?: string;
  readonly event?: string;
  readonly lane?: "main" | "overflow" | "historical";
  readonly sourceTopic?: string;
  readonly properties?: Record<string, unknown>;
}

/**
 * Build a `main`-lane {@link CapturedTransportRecord} whose routing satisfies
 * the built-in processor validation rules (target topic matches the source
 * topic, not historical) for the given capture token. Callers override the
 * pieces a specific case exercises (event name, lane, source topic).
 */
const buildRecord = (overrides: RecordOverrides): CapturedTransportRecord => {
  const lane = overrides.lane ?? "main";
  const sourceTopic = overrides.sourceTopic ?? `analytics.events.${lane}.v1`;
  const captureId = overrides.captureId ?? unique("capture");
  const distinctId = overrides.distinctId ?? unique("distinct");
  const isHistorical = lane === "historical";

  const capturedEvent: CapturedEventV1Type = {
    schemaVersion: 1,
    captureId,
    token: overrides.token,
    organizationId,
    projectId,
    event: overrides.event ?? "page_view",
    distinctId,
    eventTimestamp: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    receivedAt: new Date("2020-01-01T00:00:01.000Z").toISOString(),
    properties: (overrides.properties ?? {}) as CapturedEventV1Type["properties"],
    context: {},
    rawPayload: {},
    request: { requestId: unique("req") },
    routing: {
      routeClass: isHistorical ? "historical" : lane === "overflow" ? "overflow" : "main",
      targetTopic: sourceTopic,
      isHistorical,
      skipEnrichment: false,
    },
  };

  return {
    capturedEvent,
    headers: {},
    lane,
    rawValue: JSON.stringify(capturedEvent),
    sourceOffset: `${sourceTopic}:0:1`,
    sourcePartition: 0,
    sourceTopic,
  };
};

/** Insert a public API key (the capture token) under the fixture project. */
const insertPublicApiKey = (token: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = unique("apikey");
    yield* db.insert(apiKeys).values({
      end: token.slice(-4),
      id,
      isPublic: true,
      key: token,
      name: "Integration capture key",
      prefix: "it",
      projectId,
    });
    return id;
  });

/** Insert a processor policy row for the fixture project with the given fields. */
const insertPolicy = (overrides: {
  readonly processorEnabled?: boolean;
  readonly processorAllowOverflow?: boolean;
  readonly processorAllowHistorical?: boolean;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .insert(captureProjectPolicies)
      .values({
        processorAllowHistorical: overrides.processorAllowHistorical ?? true,
        processorAllowOverflow: overrides.processorAllowOverflow ?? true,
        processorEnabled: overrides.processorEnabled ?? true,
        projectId,
      })
      .onConflictDoUpdate({
        target: captureProjectPolicies.projectId,
        set: {
          processorAllowHistorical: overrides.processorAllowHistorical ?? true,
          processorAllowOverflow: overrides.processorAllowOverflow ?? true,
          processorEnabled: overrides.processorEnabled ?? true,
        },
      });
  });

/** Read the DLQ row recorded for a given capture id, bypassing the service. */
const findDlqRowByCaptureId = (captureId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.analyticsIngestDlq.findFirst({
      where: { captureId },
    });
  });

/** Read the identity mapping row for a distinct id under the fixture project. */
const findIdentityRow = (distinctId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personIdentities.findFirst({
      where: { projectId, distinctId },
    });
  });

/**
 * Delete everything the tests can create: DLQ rows by capture id, identity /
 * personless / migration-job / person rows by id, policy + api-key rows. Each
 * delete is `ignore`d so a missing row never turns the finalizer into a
 * failure.
 */
interface Tracked {
  readonly apiKeyIds: string[];
  readonly captureIds: string[];
  readonly distinctIds: string[];
  readonly clearedPolicy: { value: boolean };
}

const cleanup = (tracked: Tracked) =>
  Effect.gen(function* () {
    const db = yield* Db;

    if (tracked.captureIds.length > 0) {
      yield* db
        .delete(analyticsIngestDlq)
        .where(inArray(analyticsIngestDlq.captureId, tracked.captureIds))
        .pipe(Effect.ignore);
    }

    if (tracked.distinctIds.length > 0) {
      // Collect the person ids reachable from the created identity rows before
      // deleting the mappings, so the parent `person` rows can be removed too.
      const personRows = yield* db
        .select({ personId: personIdentities.personId })
        .from(personIdentities)
        .where(
          and(
            eq(personIdentities.projectId, projectId),
            inArray(personIdentities.distinctId, tracked.distinctIds),
          ),
        )
        .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<{ personId: string }>));
      const personIds = [...new Set(personRows.map((row) => row.personId))];

      yield* db
        .delete(personIdentities)
        .where(
          and(
            eq(personIdentities.projectId, projectId),
            inArray(personIdentities.distinctId, tracked.distinctIds),
          ),
        )
        .pipe(Effect.ignore);
      yield* db
        .delete(personPersonlessIdentities)
        .where(
          and(
            eq(personPersonlessIdentities.projectId, projectId),
            inArray(personPersonlessIdentities.distinctId, tracked.distinctIds),
          ),
        )
        .pipe(Effect.ignore);
      if (personIds.length > 0) {
        yield* db.delete(persons).where(inArray(persons.id, personIds)).pipe(Effect.ignore);
      }
    }

    if (tracked.apiKeyIds.length > 0) {
      yield* db.delete(apiKeys).where(inArray(apiKeys.id, tracked.apiKeyIds)).pipe(Effect.ignore);
    }

    if (tracked.clearedPolicy.value) {
      yield* db
        .delete(captureProjectPolicies)
        .where(eq(captureProjectPolicies.projectId, projectId))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so everything it creates is removed afterward, regardless of
 * how the test exits. The body records ids into the shared {@link Tracked} bag
 * via the helpers it is handed; cleanup reads the collected ids lazily at
 * finalization via `Effect.ensuring`, so it sees every id tracked while the
 * body ran (including on failure).
 */
const withCleanup = <E, R>(
  body: (track: {
    readonly apiKey: (id: string) => void;
    readonly capture: (id: string) => void;
    readonly distinct: (id: string) => void;
    readonly policy: () => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const tracked: Tracked = {
    apiKeyIds: [],
    captureIds: [],
    distinctIds: [],
    clearedPolicy: { value: false },
  };
  return body({
    apiKey: (id) => tracked.apiKeyIds.push(id),
    capture: (id) => tracked.captureIds.push(id),
    distinct: (id) => tracked.distinctIds.push(id),
    policy: () => {
      tracked.clearedPolicy.value = true;
    },
  }).pipe(Effect.ensuring(cleanup(tracked)));
};

describe("EventProcessorService.processRecordToOutputs", () => {
  test(
    "publishes a project_not_found DLQ row and returns empty outputs for an unknown token",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const captureId = unique("capture-unknown");
        track.capture(captureId);
        const record = buildRecord({ captureId, token: unique("missing-token") });

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents).toEqual([]);
        expect(outputs.personEvents).toEqual([]);
        expect(outputs.personIdentityEvents).toEqual([]);

        const dlqRow = yield* findDlqRowByCaptureId(captureId);
        expect(dlqRow).toBeDefined();
        expect(dlqRow?.failureClass).toBe("project_not_found");
        // No resolved project, so the producer falls back to the captured event's project id.
        expect(dlqRow?.projectId).toBe(projectId);

        // Nothing was identified.
        expect(yield* findIdentityRow(record.capturedEvent.distinctId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "applies the default processor policy when no policy row exists and resolves identity",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-default");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-default");
        const distinctId = unique("distinct-default");
        track.capture(captureId);
        track.distinct(distinctId);
        const record = buildRecord({ captureId, distinctId, token });

        const outputs = yield* service.processRecordToOutputs(record);

        // Default policy enables the processor, so the record is processed.
        expect(outputs.processedEvents.length).toBe(1);
        const processed = outputs.processedEvents[0]!;
        expect(processed.captureId).toBe(captureId);
        expect(processed.projectId).toBe(projectId);
        expect(processed.organizationId).toBe(organizationId);
        expect(processed.identity.distinctId).toBe(distinctId);

        // No DLQ row was written on the happy path.
        expect(yield* findDlqRowByCaptureId(captureId)).toBeUndefined();

        // A non-anonymous distinct id creates a canonical person + identity mapping.
        const identity = yield* findIdentityRow(distinctId);
        expect(identity).toBeDefined();
        expect(identity?.personId).toBe(processed.identity.personId);
        expect(outputs.personEvents.some((event) => event.personId === identity?.personId)).toBe(
          true,
        );
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "publishes a policy_rejected DLQ row and writes nothing when the processor is disabled",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-disabled");
        track.apiKey(yield* insertPublicApiKey(token));
        track.policy();
        yield* insertPolicy({ processorEnabled: false });

        const captureId = unique("capture-disabled");
        const distinctId = unique("distinct-disabled");
        track.capture(captureId);
        track.distinct(distinctId);
        const record = buildRecord({ captureId, distinctId, token });

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents).toEqual([]);
        expect(outputs.personEvents).toEqual([]);
        expect(outputs.personIdentityEvents).toEqual([]);

        const dlqRow = yield* findDlqRowByCaptureId(captureId);
        expect(dlqRow).toBeDefined();
        expect(dlqRow?.failureClass).toBe("policy_rejected");
        expect(dlqRow?.projectId).toBe(projectId);

        // Rejected before identity resolution: no person mapping written.
        expect(yield* findIdentityRow(distinctId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "publishes a schema_rejected DLQ row when routing fails the built-in validation rules",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-schema");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-schema");
        const distinctId = unique("distinct-schema");
        track.capture(captureId);
        track.distinct(distinctId);
        // targetTopic deliberately mismatches sourceTopic → validation rejects.
        const record = buildRecord({ captureId, distinctId, token });
        const mismatched: CapturedTransportRecord = {
          ...record,
          capturedEvent: {
            ...record.capturedEvent,
            routing: { ...record.capturedEvent.routing, targetTopic: "some.other.topic.v1" },
          },
        };

        const outputs = yield* service.processRecordToOutputs(mismatched);

        expect(outputs.processedEvents).toEqual([]);

        const dlqRow = yield* findDlqRowByCaptureId(captureId);
        expect(dlqRow).toBeDefined();
        expect(dlqRow?.failureClass).toBe("schema_rejected");
        expect(dlqRow?.projectId).toBe(projectId);

        expect(yield* findIdentityRow(distinctId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "publishes a reserved_event_name DLQ row for a reserved revenue event from an untrusted topic",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-reserved");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-reserved");
        const distinctId = unique("distinct-reserved");
        track.capture(captureId);
        track.distinct(distinctId);
        // A reserved $purchase.* event riding the normal (untrusted) main topic.
        const record = buildRecord({
          captureId,
          distinctId,
          token,
          event: "$purchase.completed",
        });

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents).toEqual([]);

        const dlqRow = yield* findDlqRowByCaptureId(captureId);
        expect(dlqRow).toBeDefined();
        expect(dlqRow?.failureClass).toBe("reserved_event_name");
        expect(dlqRow?.failureMessage).toContain("$purchase.completed");
        expect(dlqRow?.projectId).toBe(projectId);

        expect(yield* findIdentityRow(distinctId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "allows a reserved revenue event when it arrives on the trusted source topic",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-trusted");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-trusted");
        const distinctId = unique("distinct-trusted");
        track.capture(captureId);
        track.distinct(distinctId);
        const record = buildRecord({
          captureId,
          distinctId,
          token,
          event: "$purchase.completed",
          sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
        });

        const outputs = yield* service.processRecordToOutputs(record);

        // Trusted topic bypasses the reserved-name guard, so the event processes.
        expect(outputs.processedEvents.length).toBe(1);
        expect(outputs.processedEvents[0]!.event).toBe("$purchase.completed");
        expect(yield* findDlqRowByCaptureId(captureId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "honours a Resolved identity claim on the trusted topic — passes identity through and writes NO person/identity rows",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-resolved");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-resolved");
        const distinctId = unique("distinct-resolved");
        const personId = unique("person-resolved");
        const clientEventId = unique("evt-resolved");
        track.capture(captureId);
        track.distinct(distinctId);

        // A trusted revenue event carrying a pre-resolved identity claim — the
        // shape `dispatchTrusted` produces. The distinctId is non-anonymous, so
        // the NORMAL path would create a person + identity row; the Resolved
        // branch must skip all of that (the "revenue writes no person rows"
        // characterization).
        const base = buildRecord({
          captureId,
          distinctId,
          token,
          event: "$purchase.completed",
          sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
        });
        const record: CapturedTransportRecord = {
          ...base,
          capturedEvent: {
            ...base.capturedEvent,
            clientEventId,
            identityClaim: { _tag: "Resolved", distinctId, personId },
            trustClass: "trusted-revenue",
            routing: { ...base.capturedEvent.routing, skipEnrichment: true },
          },
        };

        const outputs = yield* service.processRecordToOutputs(record);

        // The processed event carries the claimed identity verbatim, and the
        // deterministic clientEventId becomes the event_id (processedEventId).
        expect(outputs.processedEvents.length).toBe(1);
        const processed = outputs.processedEvents[0]!;
        expect(processed.event).toBe("$purchase.completed");
        expect(processed.identity).toEqual({ distinctId, mode: "full", personId });
        expect(processed.processedEventId).toBe(clientEventId);

        // No person/identity wire events emitted...
        expect(outputs.personEvents).toEqual([]);
        expect(outputs.personIdentityEvents).toEqual([]);
        // ...and no identity row written to the DB (revenue writes no person rows).
        expect(yield* findIdentityRow(distinctId)).toBeUndefined();
        expect(yield* findDlqRowByCaptureId(captureId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "resolves a trusted Resolved event by projectId even when its token has no api_key (synthetic server token)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        // Deliberately NO api key inserted: revenue projects without a public
        // SDK key thread a synthetic `vh_server_revenue_*` token. The trusted
        // Resolved branch must resolve the project by its (server-stamped)
        // projectId rather than DLQ on the missing token.
        const syntheticToken = `vh_server_revenue_${projectId}`;
        const captureId = unique("capture-synthetic");
        const distinctId = unique("distinct-synthetic");
        const personId = unique("person-synthetic");
        track.capture(captureId);
        track.distinct(distinctId);

        const base = buildRecord({
          captureId,
          distinctId,
          token: syntheticToken,
          event: "$subscription.renewed",
          sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
        });
        const record: CapturedTransportRecord = {
          ...base,
          capturedEvent: {
            ...base.capturedEvent,
            clientEventId: unique("evt-synthetic"),
            identityClaim: { _tag: "Resolved", distinctId, personId },
            trustClass: "trusted-revenue",
            routing: { ...base.capturedEvent.routing, skipEnrichment: true },
          },
        };

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents.length).toBe(1);
        expect(outputs.processedEvents[0]!.organizationId).toBe(organizationId);
        expect(outputs.processedEvents[0]!.identity.personId).toBe(personId);
        expect(outputs.personEvents).toEqual([]);
        expect(yield* findDlqRowByCaptureId(captureId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "ignores a Resolved claim on an UNTRUSTED topic (defence-in-depth) and resolves identity normally",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-forged");
        track.apiKey(yield* insertPublicApiKey(token));

        const captureId = unique("capture-forged");
        const distinctId = unique("distinct-forged");
        const forgedPersonId = unique("person-forged");
        track.capture(captureId);
        track.distinct(distinctId);

        // A non-reserved event on the NORMAL (untrusted) topic carrying a forged
        // Resolved claim. The processor must NOT honour the claim — it falls
        // through to real identity resolution, creating its own person.
        const base = buildRecord({ captureId, distinctId, token, event: "page_view" });
        const record: CapturedTransportRecord = {
          ...base,
          capturedEvent: {
            ...base.capturedEvent,
            identityClaim: { _tag: "Resolved", distinctId, personId: forgedPersonId },
          },
        };

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents.length).toBe(1);
        // Real resolution ran: a person mapping exists and its id is NOT the
        // forged one from the ignored claim.
        const identity = yield* findIdentityRow(distinctId);
        expect(identity).toBeDefined();
        expect(identity?.personId).not.toBe(forgedPersonId);
        expect(outputs.processedEvents[0]!.identity.personId).toBe(identity?.personId);
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "promotes an anonymous identity to the target person on an $identify event",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-identify");
        track.apiKey(yield* insertPublicApiKey(token));

        const previousDistinctId = `vh:anon:${unique("anon")}`;
        const distinctId = unique("identified");
        const captureId = unique("capture-identify");
        track.capture(captureId);
        track.distinct(distinctId);
        track.distinct(previousDistinctId);

        const record = buildRecord({
          captureId,
          distinctId,
          token,
          event: "$identify",
          properties: {
            $set: { email: "person@voidhash.test" },
            $previous_distinct_id: previousDistinctId,
          },
        });

        const outputs = yield* service.processRecordToOutputs(record);

        expect(outputs.processedEvents.length).toBe(1);
        const processed = outputs.processedEvents[0]!;
        expect(processed.event).toBe("$identify");
        expect(processed.identity.distinctId).toBe(distinctId);
        expect(processed.identity.mode).toBe("full");

        // The identified distinct id is mapped to a real person.
        const identity = yield* findIdentityRow(distinctId);
        expect(identity).toBeDefined();
        expect(identity?.personId).toBe(processed.identity.personId);

        // The identify produced a person snapshot output for the target person.
        expect(outputs.personEvents.some((event) => event.personId === identity?.personId)).toBe(
          true,
        );
        expect(yield* findDlqRowByCaptureId(captureId)).toBeUndefined();
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "serialises concurrent records that share the same (token, distinctId) identity key",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* EventProcessorService;

        const token = unique("token-serial");
        track.apiKey(yield* insertPublicApiKey(token));

        // Same distinct id (and token) for both records → same identity key, so
        // the scheduler must run their identity-resolution effects one at a
        // time. A non-anonymous distinct id with shouldCreatePerson=true would
        // race on the unique (project_id, distinct_id) identity index if the
        // two effects overlapped; serialisation means both observe one person.
        const distinctId = unique("distinct-serial");
        track.distinct(distinctId);
        const captureA = unique("capture-serial-a");
        const captureB = unique("capture-serial-b");
        track.capture(captureA);
        track.capture(captureB);

        const recordA = buildRecord({ captureId: captureA, distinctId, token });
        const recordB = buildRecord({ captureId: captureB, distinctId, token });

        const [outputsA, outputsB] = yield* Effect.all(
          [service.processRecordToOutputs(recordA), service.processRecordToOutputs(recordB)],
          { concurrency: 2 },
        );

        expect(outputsA.processedEvents.length).toBe(1);
        expect(outputsB.processedEvents.length).toBe(1);

        // Exactly one canonical person backs the shared distinct id.
        const identity = yield* findIdentityRow(distinctId);
        expect(identity).toBeDefined();
        expect(outputsA.processedEvents[0]!.identity.personId).toBe(identity?.personId);
        expect(outputsB.processedEvents[0]!.identity.personId).toBe(identity?.personId);

        const db = yield* Db;
        const identityRows = yield* db
          .select({ id: personIdentities.id })
          .from(personIdentities)
          .where(
            and(
              eq(personIdentities.projectId, projectId),
              eq(personIdentities.distinctId, distinctId),
            ),
          );
        expect(identityRows.length).toBe(1);
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );
});
