/**
 * Integration tests for {@link AnalyticsWriterService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts`. Both
 * storage backends are live: MySQL (the `project → organization` lookup) and
 * ClickHouse (the five fan-out tables). The harness binds ClickHouse's
 * read-write user (see `stacks/backend.ts` `makeTestConnections`), which has
 * `GRANT ALL` and reads cross-tenant rows with no row policy — so this test can
 * both insert and read its own rows back directly via
 * {@link ClickhouseWebClient}, without a `SQL_organization_id` setting.
 *
 * Each test drives `writeMessages` end-to-end and verifies the *persisted* side
 * effects, not just the returned counts:
 *  - processed-event rows land in `events_v2` (read back by `event_id`),
 *  - person / identity / override / pending-override rows land in their tables,
 *  - the `organization_id` written onto person/identity rows is the one
 *    resolved from MySQL `project` (not the upstream-stamped value),
 *  - the three dedup paths (within-batch revenue, ClickHouse-existing event,
 *    ClickHouse-existing revenue within the safety window) actually drop rows
 *    before insert, so `insertedRowCount` reflects real inserts.
 *
 * Conventions:
 *  - `writeMessages` carries no `AuthSession` permission guard, so there is no
 *    forbidden-path case; the harness skeleton's `CoreAuthSession.authenticate()`
 *    is still applied for uniformity.
 *  - Every test namespaces its rows with a unique `event_id` / `distinct_id` /
 *    `person_id` (via {@link uniqueId}) and asserts by membership, never by a
 *    table-wide count, so a leftover row from a crashed run can't collide.
 *  - ClickHouse `MergeTree` has no cascading delete, so {@link withClickhouseCleanup}
 *    issues a best-effort `ALTER TABLE … DELETE WHERE event_id|distinct_id IN (…)`
 *    mutation per table on exit (success or failure) via `Effect.ensuring`. The
 *    global MySQL sweep does not touch ClickHouse, so this self-cleanup is the
 *    only thing that reclaims these rows.
 *  - Typed failures are asserted with `Effect.flip` + `instanceof`, paired with
 *    a state assertion on the failure path (project convention).
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { AnalyticsWriterService } from "@voidhash/core/services/analyticsIngest/AnalyticsWriterService";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type { AnalyticsWriterMessageType } from "@voidhash/core/domain/analyticsIngest/AnalyticsIngest";
import { REVENUE_TRUSTED_SOURCE_TOPIC } from "@voidhash/core/domain/internalAnalytics/InternalAnalyticsEvents";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

const EVENTS_TABLE = "events_v2";
const PERSONS_TABLE = "persons_v1";
const PERSON_IDENTITY_TABLE = "person_identity_v1";
const PERSON_IDENTITY_OVERRIDES_TABLE = "person_identity_overrides_v1";
const PERSON_IDENTITY_PENDING_OVERRIDES_TABLE = "person_identity_pending_overrides_v2";

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
const uniqueId = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-aw-${label}-${now}-${idSeq++}`);

/** A reservation-grade revenue event name (drives the revenue dedup path). */
const REVENUE_EVENT_NAME = "$purchase.completed";

/**
 * Build a `processed` writer message. The default `event` is a customer
 * (non-revenue) event; pass `{ event, sourceTopic }` overrides to make it a
 * trusted revenue event that the dedup helpers recognize. `eventTimestamp`
 * controls the row's `event_ts`, which the revenue safety-window cutoff reads.
 */
const processedMessage = (overrides: {
  readonly event?: string;
  readonly eventId: string;
  readonly distinctId?: string;
  readonly eventTimestamp?: string;
  readonly sourceTopic?: string;
}): Effect.Effect<AnalyticsWriterMessageType> =>
  Effect.gen(function* () {
    const distinctId = overrides.distinctId ?? (yield* uniqueId("distinct"));
    const eventTimestamp = overrides.eventTimestamp ?? (yield* DateTime.nowAsDate).toISOString();
    const personId = yield* uniqueId("person");
    const token = yield* uniqueId("token");
    return {
      kind: "processed",
      messageId: overrides.eventId,
      value: {
        captureId: `cap-${overrides.eventId}`,
        context: {},
        distinctId,
        event: overrides.event ?? "checkout_started",
        eventTimestamp,
        groups: [],
        identity: { distinctId, mode: "full", personId },
        organizationId,
        processedAt: eventTimestamp,
        processedEventId: overrides.eventId,
        projectId,
        properties: { plan: "pro" },
        request: { path: "/i/v1/capture", requestId: `req-${overrides.eventId}` },
        routing: {
          lane: "main",
          skipEnrichment: false,
          sourceOffset: overrides.eventId,
          sourcePartition: 0,
          sourceTopic: overrides.sourceTopic ?? "capture.v1",
        },
        schemaVersion: 2,
        token,
      },
    };
  });

/**
 * Build a `person` writer message under the fixture project. The
 * `primaryDistinctId` is taken from the caller so the test can `trackDistinct`
 * it: the `persons_v1` cleanup keys on `primary_distinct_id`, so the row would
 * otherwise leak (the global MySQL sweep never touches ClickHouse).
 */
const personMessage = (overrides: {
  readonly personId: string;
  readonly primaryDistinctId: string;
}): Effect.Effect<AnalyticsWriterMessageType> =>
  Effect.map(DateTime.nowAsDate, (now) => ({
    kind: "person",
    messageId: overrides.personId,
    value: {
      changedAt: now.toISOString(),
      isArchived: false,
      name: "Integration Person",
      personId: overrides.personId,
      primaryDistinctId: overrides.primaryDistinctId,
      projectId,
      schemaVersion: 1,
      traits: { tier: "gold" },
      version: 1,
    },
  }));

/**
 * Build a `person-distinct-id` writer message. A non-empty `previousDistinctId`
 * with `version > 0` makes the plan also emit override + pending-override rows.
 */
const personIdentityMessage = (overrides: {
  readonly personId: string;
  readonly distinctId: string;
  readonly previousDistinctId?: string;
  readonly version?: number;
}): Effect.Effect<AnalyticsWriterMessageType> =>
  Effect.map(DateTime.nowAsDate, (now) => ({
    kind: "person-distinct-id",
    messageId: overrides.personId,
    value: {
      changedAt: now.toISOString(),
      distinctId: overrides.distinctId,
      isDeleted: false,
      personId: overrides.personId,
      previousDistinctId: overrides.previousDistinctId,
      projectId,
      schemaVersion: 1,
      version: overrides.version ?? 1,
    },
  }));

/** Read back the processed-event rows for the given ids straight from ClickHouse. */
const findEventRows = (eventIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (eventIds.length === 0) return [];
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    return yield* ch<{
      event_id: string;
      event_name: string;
      organization_id: string;
      project_id: string;
      distinct_id: string;
      source_topic: string;
    }>`SELECT event_id, event_name, organization_id, project_id, distinct_id, source_topic
       FROM ${ch.literal(EVENTS_TABLE)} WHERE event_id IN ${ch.param("Array(String)", [...eventIds])}`;
  });

/** Read back the person rows for the given person ids. */
const findPersonRows = (personIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (personIds.length === 0) return [];
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    return yield* ch<{
      person_id: string;
      organization_id: string;
      project_id: string;
    }>`SELECT person_id, organization_id, project_id
       FROM ${ch.literal(PERSONS_TABLE)} WHERE person_id IN ${ch.param("Array(String)", [...personIds])}`;
  });

/** The distinct-id column each identity table keys its rows on. */
const identityColumn = (table: string): string => {
  if (table === PERSON_IDENTITY_PENDING_OVERRIDES_TABLE) {
    return "target_distinct_id";
  }
  return "distinct_id";
};

/** Read back rows from one of the three identity tables by `distinct_id`. */
const findIdentityRows = (table: string, distinctIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (distinctIds.length === 0) return [];
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const column = identityColumn(table);
    return yield* ch<{
      person_id: string;
      organization_id: string;
      project_id: string;
    }>`SELECT person_id, organization_id, project_id
       FROM ${ch.literal(table)} WHERE ${ch.literal(column)} IN ${ch.param("Array(String)", [...distinctIds])}`;
  });

/**
 * Best-effort ClickHouse reclamation. MergeTree mutations are asynchronous, so
 * each `ALTER TABLE … DELETE` is fire-and-forget and `ignore`d — a failed or
 * slow mutation must never turn the finalizer into a test failure. Events are
 * cleared by `event_id`; the four person/identity tables by `distinct_id`
 * (`target_distinct_id` for the pending-overrides table).
 */
const cleanupClickhouse = (created: {
  readonly eventIds: ReadonlyArray<string>;
  readonly distinctIds: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const eventIds = [...created.eventIds];
    const distinctIds = [...created.distinctIds];

    if (eventIds.length > 0) {
      yield* ch
        .asCommand(
          ch`ALTER TABLE ${ch.literal(EVENTS_TABLE)} DELETE WHERE event_id IN ${ch.param("Array(String)", eventIds)}`,
        )
        .pipe(Effect.ignore);
    }
    if (distinctIds.length > 0) {
      for (const table of [PERSONS_TABLE]) {
        yield* ch
          .asCommand(
            ch`ALTER TABLE ${ch.literal(table)} DELETE WHERE primary_distinct_id IN ${ch.param("Array(String)", distinctIds)}`,
          )
          .pipe(Effect.ignore);
      }
      for (const table of [PERSON_IDENTITY_TABLE, PERSON_IDENTITY_OVERRIDES_TABLE]) {
        yield* ch
          .asCommand(
            ch`ALTER TABLE ${ch.literal(table)} DELETE WHERE distinct_id IN ${ch.param("Array(String)", distinctIds)}`,
          )
          .pipe(Effect.ignore);
      }
      yield* ch
        .asCommand(
          ch`ALTER TABLE ${ch.literal(PERSON_IDENTITY_PENDING_OVERRIDES_TABLE)} DELETE WHERE target_distinct_id IN ${ch.param("Array(String)", distinctIds)}`,
        )
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every ClickHouse row it writes is reclaimed afterward,
 * regardless of how the test exits. Pass each written `event_id` to `trackEvent`
 * and each `distinct_id` (events + identity tables key on it) to `trackDistinct`;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`.
 */
const withClickhouseCleanup = <E, R>(
  body: (track: {
    readonly trackEvent: (id: string) => void;
    readonly trackDistinct: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | ClickhouseWebClient.ClickhouseWebClient> => {
  const eventIds: string[] = [];
  const distinctIds: string[] = [];
  return body({
    trackDistinct: (id) => {
      distinctIds.push(id);
    },
    trackEvent: (id) => {
      eventIds.push(id);
    },
  }).pipe(Effect.ensuring(cleanupClickhouse({ distinctIds, eventIds })));
};

describe("AnalyticsWriterService.writeMessages", () => {
  test(
    "fans the three message kinds out into all five ClickHouse tables in one batch",
    withClickhouseCleanup(({ trackDistinct, trackEvent }) =>
      Effect.gen(function* () {
        const writer = yield* AnalyticsWriterService;

        const eventId = yield* uniqueId("fanout-event");
        const eventDistinct = yield* uniqueId("fanout-event-distinct");
        const personId = yield* uniqueId("fanout-person");
        const personPrimaryDistinct = yield* uniqueId("fanout-person-primary");
        const identityDistinct = yield* uniqueId("fanout-identity-distinct");
        const identityPrevious = yield* uniqueId("fanout-identity-prev");
        trackEvent(eventId);
        trackDistinct(eventDistinct);
        trackDistinct(personPrimaryDistinct);
        trackDistinct(identityDistinct);

        const messages: ReadonlyArray<AnalyticsWriterMessageType> = [
          yield* processedMessage({ distinctId: eventDistinct, eventId }),
          yield* personMessage({ personId, primaryDistinctId: personPrimaryDistinct }),
          // version > 0 + a previous distinct id → also emits override +
          // pending-override rows, exercising all five tables at once.
          yield* personIdentityMessage({
            distinctId: identityDistinct,
            personId,
            previousDistinctId: identityPrevious,
            version: 3,
          }),
        ];

        const result = yield* writer.writeMessages(messages);
        // 1 processed + 1 person + 1 identity + 1 override + 1 pending = 5 rows.
        expect(result.insertedRowCount).toBe(5);
        expect(result.messageCount).toBe(3);

        const eventRows = yield* findEventRows([eventId]);
        expect(eventRows.some((row) => row.event_id === eventId)).toBe(true);

        const personRows = yield* findPersonRows([personId]);
        expect(personRows.some((row) => row.person_id === personId)).toBe(true);

        const identityRows = yield* findIdentityRows(PERSON_IDENTITY_TABLE, [identityDistinct]);
        expect(identityRows.some((row) => row.person_id === personId)).toBe(true);

        const overrideRows = yield* findIdentityRows(PERSON_IDENTITY_OVERRIDES_TABLE, [
          identityDistinct,
        ]);
        expect(overrideRows.some((row) => row.person_id === personId)).toBe(true);

        const pendingRows = yield* findIdentityRows(PERSON_IDENTITY_PENDING_OVERRIDES_TABLE, [
          identityDistinct,
        ]);
        expect(pendingRows.some((row) => row.person_id === personId)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "resolves project → organization from MySQL and stamps it on person/identity rows",
    withClickhouseCleanup(({ trackDistinct }) =>
      Effect.gen(function* () {
        const writer = yield* AnalyticsWriterService;

        const personId = yield* uniqueId("org-person");
        const personPrimaryDistinct = yield* uniqueId("org-person-primary");
        const identityDistinct = yield* uniqueId("org-identity-distinct");
        trackDistinct(personPrimaryDistinct);
        trackDistinct(identityDistinct);

        // Person/identity messages carry only projectId; the writer looks up the
        // organization in MySQL. The fixture seeds it_project under it_org.
        yield* writer.writeMessages([
          yield* personMessage({ personId, primaryDistinctId: personPrimaryDistinct }),
          yield* personIdentityMessage({ distinctId: identityDistinct, personId }),
        ]);

        const personRows = yield* findPersonRows([personId]);
        const personRow = personRows.find((row) => row.person_id === personId);
        expect(personRow).toBeDefined();
        expect(personRow?.organization_id).toBe(organizationId);
        expect(personRow?.project_id).toBe(projectId);

        const identityRows = yield* findIdentityRows(PERSON_IDENTITY_TABLE, [identityDistinct]);
        const identityRow = identityRows.find((row) => row.person_id === personId);
        expect(identityRow).toBeDefined();
        expect(identityRow?.organization_id).toBe(organizationId);
      }),
    ).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "deduplicates revenue events sharing an event_id within the batch (only one row inserted)",
    withClickhouseCleanup(({ trackEvent }) =>
      Effect.gen(function* () {
        const writer = yield* AnalyticsWriterService;

        const sharedEventId = yield* uniqueId("batch-dup-event");
        trackEvent(sharedEventId);

        // Two trusted revenue messages with the SAME event_id: within-batch dedup
        // keeps the first and skips the second. The two non-revenue events have
        // distinct ids and pass through untouched.
        const passEventA = yield* uniqueId("batch-pass-a");
        const passEventB = yield* uniqueId("batch-pass-b");
        trackEvent(passEventA);
        trackEvent(passEventB);

        const result = yield* writer.writeMessages([
          yield* processedMessage({
            event: REVENUE_EVENT_NAME,
            eventId: sharedEventId,
            sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
          }),
          yield* processedMessage({
            event: REVENUE_EVENT_NAME,
            eventId: sharedEventId,
            sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
          }),
          yield* processedMessage({ eventId: passEventA }),
          yield* processedMessage({ eventId: passEventB }),
        ]);

        // 4 messages in, but the duplicate revenue row is dropped → 3 inserted.
        expect(result.messageCount).toBe(4);
        expect(result.insertedRowCount).toBe(3);

        const rows = yield* findEventRows([sharedEventId]);
        expect(rows.filter((row) => row.event_id === sharedEventId)).toHaveLength(1);
      }),
    ).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "filters out events already present in ClickHouse (clickhouse_existing dedup) before insert",
    withClickhouseCleanup(({ trackEvent }) =>
      Effect.gen(function* () {
        const writer = yield* AnalyticsWriterService;

        const existingId = yield* uniqueId("existing-event");
        const freshId = yield* uniqueId("fresh-event");
        trackEvent(existingId);
        trackEvent(freshId);

        // Seed `existingId` so the writer's fetchExistingEventIds sees it and
        // skips it; only the fresh event should be inserted.
        yield* writer.writeMessages([yield* processedMessage({ eventId: existingId })]);

        const result = yield* writer.writeMessages([
          yield* processedMessage({ eventId: existingId }),
          yield* processedMessage({ eventId: freshId }),
        ]);

        // 2 messages in, but `existingId` is already in ClickHouse → 1 inserted.
        expect(result.messageCount).toBe(2);
        expect(result.insertedRowCount).toBe(1);

        // Still exactly one row for the existing id (the duplicate was not written).
        const existingRows = yield* findEventRows([existingId]);
        expect(existingRows.filter((row) => row.event_id === existingId)).toHaveLength(1);
        const freshRows = yield* findEventRows([freshId]);
        expect(freshRows.some((row) => row.event_id === freshId)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "deduplicates an already-present revenue event by (project_id, event_id) regardless of age (no time window)",
    withClickhouseCleanup(({ trackEvent }) =>
      Effect.gen(function* () {
        const writer = yield* AnalyticsWriterService;

        const existingRevenueId = yield* uniqueId("existing-revenue");
        const freshRevenueId = yield* uniqueId("fresh-revenue");
        trackEvent(existingRevenueId);
        trackEvent(freshRevenueId);

        // Seed an existing trusted-revenue row dated WELL OUTSIDE any legacy
        // 7-day safety window (90 days ago). The unbounded (project_id, event_id)
        // dedup must still catch its re-dispatch — this is the at-least-once
        // guarantee: a late ledger retry or duplicate provider redelivery
        // collapses no matter how stale.
        const nowMillis = yield* Clock.currentTimeMillis;
        const ninetyDaysAgo = DateTime.toDateUtc(
          DateTime.makeUnsafe(nowMillis - 90 * 24 * 60 * 60 * 1000),
        ).toISOString();
        yield* writer.writeMessages([
          yield* processedMessage({
            event: REVENUE_EVENT_NAME,
            eventId: existingRevenueId,
            eventTimestamp: ninetyDaysAgo,
            sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
          }),
        ]);

        // Second batch re-sends the (90-day-old) existing revenue id plus a fresh
        // one. The already-present revenue row is not re-inserted; the fresh one is.
        const result = yield* writer.writeMessages([
          yield* processedMessage({
            event: REVENUE_EVENT_NAME,
            eventId: existingRevenueId,
            eventTimestamp: ninetyDaysAgo,
            sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
          }),
          yield* processedMessage({
            event: REVENUE_EVENT_NAME,
            eventId: freshRevenueId,
            eventTimestamp: (yield* DateTime.nowAsDate).toISOString(),
            sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
          }),
        ]);

        expect(result.messageCount).toBe(2);
        expect(result.insertedRowCount).toBe(1);

        const existingRows = yield* findEventRows([existingRevenueId]);
        expect(existingRows.filter((row) => row.event_id === existingRevenueId)).toHaveLength(1);
        const freshRows = yield* findEventRows([freshRevenueId]);
        expect(freshRows.some((row) => row.event_id === freshRevenueId)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns insertedRowCount=0 and messageCount=0 for an empty batch and writes nothing",
    // No cleanup wrapper: an empty batch writes no rows.
    Effect.gen(function* () {
      const writer = yield* AnalyticsWriterService;
      const result = yield* writer.writeMessages([]);
      expect(result.insertedRowCount).toBe(0);
      expect(result.messageCount).toBe(0);
    }).pipe(Effect.provide(AnalyticsWriterService.layer), CoreAuthSession.authenticate()),
  );

  vitestTest.todo(
    "ClickhouseError branch: wraps a ClickHouse insert failure as AnalyticsWriterServiceError and writes nothing for the bad row. Deferred — there is no schema-valid `writeMessages` input that deterministically makes the live ClickHouse Cloud instance reject an `insertBatch`. The previous attempt (an out-of-Int32 `source_partition` of 9_999_999_999) was silently accepted by JSONEachRow on this instance (the insert succeeded with insertedRowCount=1), and a far-future DateTime64 is likewise tolerated here (the sibling AnalyticsJanitorService DateTime64-ceiling case returned a normal result in the same run). Because every field flows through `AnalyticsWriterMessageType` schema validation, no wrong-typed/NULL value can reach a non-Nullable column, and the only remaining way to force a ClickhouseError is a fault-injecting Clickhouse double, which the integration tier forbids. The catchTags(ClickhouseError → AnalyticsWriterServiceError) wrapping is exercised at the unit tier instead.",
  );

  vitestTest.todo(
    "DatabaseError branch: wraps a MySQL failure during project→organization resolution. Deferred — `resolveOrganizationByProject` only fails if the live `project` SELECT errors (e.g. connection loss / dropped table); there is no in-process seam to inject a DatabaseError through the public `writeMessages` API without faking the Db layer, which integration tests forbid. The success-path org resolution is already covered above.",
  );
});
