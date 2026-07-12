/**
 * Integration tests for {@link IdentityProjectionPublisher}, run against the
 * real backend stack provisioned once by `test/_testing/globalSetup.ts`.
 *
 * The unit under test is the `analyticsWriterLayer` composition: it transforms
 * the `IdentityProjectionInput` (the person snapshots + identity mapping events
 * the identify-completion workflow produces) into the analytics writer's tagged
 * message union and hands them to the *real* {@link AnalyticsWriterService},
 * which fans them out into ClickHouse (`persons_v1` / `person_identity_v1`).
 *
 * Because the writer is real, these tests verify the *persisted* ClickHouse
 * rows rather than the (discarded) intermediate `messageId`s — proving the two
 * pure transforms (`toProcessorPersonEvent`, `toProcessorPersonIdentityEvent`)
 * end-to-end:
 *  - person snapshots land in `persons_v1` with their traits / version and the
 *    organization id resolved from MySQL `project` by the writer,
 *  - identity mappings land in `person_identity_v1` with the correct
 *    `previous_distinct_id` derivation,
 *  - optional person fields (`email` / `name` / `primary_distinct_id` /
 *    `merged_into_person_id`) are omitted (written `NULL`) when absent and
 *    present when supplied,
 *  - a ClickHouse insert failure surfaces as the publisher's stable
 *    {@link QueueProducerError} tagged with `queueName: "AnalyticsWriterService"`.
 *
 * Conventions (mirroring {@link AnalyticsWriterService} integration tests):
 *  - The harness binds ClickHouse's read-write user, which reads cross-tenant
 *    rows with no row policy, so these tests both insert (via the publisher) and
 *    read their own rows back directly via {@link ClickhouseWebClient}.
 *  - Every row is namespaced by a unique `person_id` / `distinct_id` (via
 *    {@link uniqueId}) and asserted by membership, never by a table-wide count.
 *  - ClickHouse `MergeTree` has no cascading delete, so
 *    {@link withClickhouseCleanup} issues a best-effort `ALTER TABLE … DELETE`
 *    mutation per table on exit (success or failure) via `Effect.ensuring`.
 *  - Typed failures are asserted with `Effect.flip` + `instanceof`, paired with
 *    a state assertion on the failure path (project convention).
 *  - `publishIdentityResult` carries no `AuthSession` permission guard, so there
 *    is no forbidden-path case; the harness skeleton's
 *    `CoreAuthSession.authenticate()` is still applied for uniformity.
 *  - The `noop` layer is intentionally untested here: it returns `Effect.void`
 *    and is exercised through `PersonIdentityService`'s own tests (see the
 *    per-target plan notes).
 */
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { AnalyticsWriterService } from "@voidhash/core/services/analyticsIngest/AnalyticsWriterService";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { QueueProducerError } from "@voidhash/core/services/infrastructure/QueueProducer";
import type {
  PersonIdentityEventV1,
  PersonSnapshotEventV1,
} from "@voidhash/core/domain/person/Person";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

const PERSONS_TABLE = "persons_v1";
const PERSON_IDENTITY_TABLE = "person_identity_v1";
// A mapping event whose `distinctId` differs from `identity.distinctId` AND
// whose `version > 0` makes the writer's plan ALSO emit override +
// pending-override rows (keyed by the rewritten identity distinct id), so these
// must be reclaimed too — the global MySQL sweep never touches ClickHouse.
const PERSON_IDENTITY_OVERRIDES_TABLE = "person_identity_overrides_v1";
const PERSON_IDENTITY_PENDING_OVERRIDES_TABLE = "person_identity_pending_overrides_v2";

/**
 * The publisher's `analyticsWriterLayer` wired over the real
 * {@link AnalyticsWriterService}. The writer in turn only needs `ClickhouseWebClient`
 * and `Db`, both provided by the harness, so the test's remaining requirements stay
 * within the harness service set.
 */
const PublisherLayer = IdentityProjectionPublisher.analyticsWriterLayer.pipe(
  Layer.provide(AnalyticsWriterService.layer),
);

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
const uniqueId = (label: string) => `it-ipp-${label}-${Date.now()}-${idSeq++}`;

/**
 * Build a {@link PersonSnapshotEventV1}. Optional fields (`email` / `name` /
 * `mergedIntoPersonId` / `primaryDistinctId`) are only set when supplied, so a
 * test can drive the optional-field omission branch of `toProcessorPersonEvent`.
 */
const personEvent = (overrides: {
  readonly personId: string;
  readonly email?: string;
  readonly name?: string;
  readonly mergedIntoPersonId?: string;
  readonly primaryDistinctId?: string;
  readonly traits?: Record<string, unknown>;
  readonly version?: number;
  readonly isArchived?: boolean;
}): PersonSnapshotEventV1 => ({
  changedAt: new Date().toISOString(),
  personId: overrides.personId,
  ...(overrides.email ? { email: overrides.email } : {}),
  isArchived: overrides.isArchived ?? false,
  ...(overrides.mergedIntoPersonId ? { mergedIntoPersonId: overrides.mergedIntoPersonId } : {}),
  ...(overrides.name ? { name: overrides.name } : {}),
  ...(overrides.primaryDistinctId ? { primaryDistinctId: overrides.primaryDistinctId } : {}),
  projectId,
  schemaVersion: 1,
  traits: overrides.traits ?? {},
  version: overrides.version ?? 1,
});

/** Build a {@link PersonIdentityEventV1} mapping `distinctId` → `personId`. */
const mappingEvent = (overrides: {
  readonly personId: string;
  readonly distinctId: string;
  readonly version?: number;
  readonly isDeleted?: boolean;
}): PersonIdentityEventV1 => ({
  changedAt: new Date().toISOString(),
  distinctId: overrides.distinctId,
  isDeleted: overrides.isDeleted ?? false,
  // `kind` is part of the wire event but the publisher's identity transform
  // ignores it (it never reaches ClickHouse); `2` is `PersonIdentityKind.Identified`,
  // kept here only so the fixture stays realistic.
  kind: 2,
  personId: overrides.personId,
  projectId,
  schemaVersion: 1,
  version: overrides.version ?? 1,
});

/** Read back the person rows for the given person ids straight from ClickHouse. */
const findPersonRows = (personIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (personIds.length === 0) return [];
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    return yield* ch<{
      person_id: string;
      organization_id: string;
      project_id: string;
      email: string | null;
      name: string | null;
      primary_distinct_id: string | null;
      merged_into_person_id: string | null;
      is_archived: number;
      version: string;
      traits: string;
    }>`SELECT person_id, organization_id, project_id, email, name, primary_distinct_id,
              merged_into_person_id, is_archived, toString(version) AS version, traits
       FROM ${ch.literal(PERSONS_TABLE)} WHERE person_id IN ${ch.param("Array(String)", [...personIds])}`;
  });

/**
 * Read back the identity-mapping rows for the given distinct ids.
 *
 * `person_identity_v1` is `ReplacingMergeTree(version)` keyed on
 * `(project_id, distinct_id)`, so reads use `FINAL` to collapse duplicate sort
 * keys to the surviving (highest-`version`) row deterministically — without it
 * the result would depend on background merge timing.
 */
const findIdentityRows = (distinctIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (distinctIds.length === 0) return [];
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    return yield* ch<{
      person_id: string;
      organization_id: string;
      project_id: string;
      distinct_id: string;
      previous_distinct_id: string | null;
      is_deleted: number;
      version: string;
    }>`SELECT person_id, organization_id, project_id, distinct_id, previous_distinct_id,
              is_deleted, toString(version) AS version
       FROM ${ch.literal(PERSON_IDENTITY_TABLE)} FINAL WHERE distinct_id IN ${ch.param("Array(String)", [...distinctIds])}`;
  });

/**
 * Best-effort ClickHouse reclamation. MergeTree mutations are asynchronous, so
 * each `ALTER TABLE … DELETE` is fire-and-forget and `ignore`d — a failed or
 * slow mutation must never turn the finalizer into a test failure. Persons are
 * cleared by `person_id`; identity rows by `distinct_id`. The override table is
 * keyed by the same (rewritten) `distinct_id` and the pending-override table by
 * `target_distinct_id`, so the tracked identity distinct ids reclaim those too
 * — a mapping with a derived `previous_distinct_id` and `version > 0` lands rows
 * in all three identity tables.
 */
const cleanupClickhouse = (created: {
  readonly personIds: ReadonlyArray<string>;
  readonly distinctIds: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const personIds = [...created.personIds];
    const distinctIds = [...created.distinctIds];

    if (personIds.length > 0) {
      yield* ch
        .asCommand(
          ch`ALTER TABLE ${ch.literal(PERSONS_TABLE)} DELETE WHERE person_id IN ${ch.param("Array(String)", personIds)}`,
        )
        .pipe(Effect.ignore);
    }
    if (distinctIds.length > 0) {
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
 * regardless of how the test exits. Pass each written `person_id` to
 * `trackPerson` and each `distinct_id` to `trackDistinct`; cleanup reads the
 * collected ids lazily at finalization via `Effect.ensuring`.
 */
const withClickhouseCleanup = <E, R>(
  body: (track: {
    readonly trackPerson: (id: string) => void;
    readonly trackDistinct: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | ClickhouseWebClient.ClickhouseWebClient> => {
  const personIds: string[] = [];
  const distinctIds: string[] = [];
  return body({
    trackDistinct: (id) => {
      distinctIds.push(id);
    },
    trackPerson: (id) => {
      personIds.push(id);
    },
  }).pipe(Effect.ensuring(cleanupClickhouse({ distinctIds, personIds })));
};

describe("IdentityProjectionPublisher.publishIdentityResult (analyticsWriterLayer)", () => {
  test(
    "transforms an identified person snapshot + mapping event into ClickHouse rows",
    withClickhouseCleanup(({ trackDistinct, trackPerson }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personId = uniqueId("happy-person");
        const distinctId = uniqueId("happy-distinct");
        trackPerson(personId);
        trackDistinct(distinctId);

        yield* publisher.publishIdentityResult({
          identity: { distinctId },
          mappingEvents: [mappingEvent({ distinctId, personId, version: 2 })],
          personEvents: [
            personEvent({
              email: "happy@voidhash.test",
              name: "Happy Person",
              personId,
              primaryDistinctId: distinctId,
              traits: { tier: "gold" },
              version: 5,
            }),
          ],
        });

        const personRows = yield* findPersonRows([personId]);
        const personRow = personRows.find((row) => row.person_id === personId);
        expect(personRow).toBeDefined();
        expect(personRow?.project_id).toBe(projectId);
        // Writer resolves the organization from MySQL `project`, not from the event.
        expect(personRow?.organization_id).toBe(organizationId);
        expect(personRow?.email).toBe("happy@voidhash.test");
        expect(personRow?.name).toBe("Happy Person");
        expect(personRow?.primary_distinct_id).toBe(distinctId);
        expect(personRow?.is_archived).toBe(0);
        expect(personRow?.version).toBe("5");
        expect(JSON.parse(personRow?.traits ?? "{}")).toEqual({ tier: "gold" });

        const identityRows = yield* findIdentityRows([distinctId]);
        const identityRow = identityRows.find((row) => row.distinct_id === distinctId);
        expect(identityRow).toBeDefined();
        expect(identityRow?.person_id).toBe(personId);
        expect(identityRow?.project_id).toBe(projectId);
        expect(identityRow?.organization_id).toBe(organizationId);
        expect(identityRow?.is_deleted).toBe(0);
        expect(identityRow?.version).toBe("2");
        // distinctId === identity.distinctId → no previous distinct id derived.
        expect(identityRow?.previous_distinct_id).toBeNull();
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "omits optional person fields (email/name/primaryDistinctId/mergedIntoPersonId) when absent",
    withClickhouseCleanup(({ trackPerson }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personId = uniqueId("minimal-person");
        trackPerson(personId);

        // Only the required fields — every optional field is absent, so the
        // transform must omit it (and the writer writes NULL).
        yield* publisher.publishIdentityResult({
          identity: { distinctId: uniqueId("minimal-distinct") },
          mappingEvents: [],
          personEvents: [personEvent({ personId })],
        });

        const personRows = yield* findPersonRows([personId]);
        const personRow = personRows.find((row) => row.person_id === personId);
        expect(personRow).toBeDefined();
        expect(personRow?.email).toBeNull();
        expect(personRow?.name).toBeNull();
        expect(personRow?.primary_distinct_id).toBeNull();
        expect(personRow?.merged_into_person_id).toBeNull();
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "includes optional person fields (email/name/primaryDistinctId/mergedIntoPersonId) when present",
    withClickhouseCleanup(({ trackPerson }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personId = uniqueId("full-person");
        const mergedInto = uniqueId("full-merged");
        const primaryDistinct = uniqueId("full-primary");
        trackPerson(personId);

        yield* publisher.publishIdentityResult({
          identity: { distinctId: primaryDistinct },
          mappingEvents: [],
          personEvents: [
            personEvent({
              email: "full@voidhash.test",
              isArchived: true,
              mergedIntoPersonId: mergedInto,
              name: "Full Person",
              personId,
              primaryDistinctId: primaryDistinct,
            }),
          ],
        });

        const personRows = yield* findPersonRows([personId]);
        const personRow = personRows.find((row) => row.person_id === personId);
        expect(personRow).toBeDefined();
        expect(personRow?.email).toBe("full@voidhash.test");
        expect(personRow?.name).toBe("Full Person");
        expect(personRow?.primary_distinct_id).toBe(primaryDistinct);
        expect(personRow?.merged_into_person_id).toBe(mergedInto);
        expect(personRow?.is_archived).toBe(1);
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "derives previous_distinct_id when the mapping distinct id differs from the identity distinct id",
    withClickhouseCleanup(({ trackDistinct }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personId = uniqueId("prev-person");
        const identityDistinct = uniqueId("prev-identity");
        const mappingDistinct = uniqueId("prev-mapping");
        // The persisted identity row is keyed by the identity distinct id (the
        // transform rewrites `distinctId` to it and stores the mapping distinct
        // id as `previous_distinct_id`), so reclaim by that id. Because a
        // derived previous distinct id + `version > 0` also lands override +
        // pending-override rows (both keyed by this same identity distinct id),
        // tracking it reclaims all three identity tables.
        trackDistinct(identityDistinct);

        yield* publisher.publishIdentityResult({
          identity: { distinctId: identityDistinct },
          mappingEvents: [mappingEvent({ distinctId: mappingDistinct, personId, version: 3 })],
          personEvents: [],
        });

        const identityRows = yield* findIdentityRows([identityDistinct]);
        const identityRow = identityRows.find((row) => row.distinct_id === identityDistinct);
        expect(identityRow).toBeDefined();
        expect(identityRow?.person_id).toBe(personId);
        // distinctId rewritten to the identity distinct id, mapping distinct id
        // becomes the previous distinct id.
        expect(identityRow?.distinct_id).toBe(identityDistinct);
        expect(identityRow?.previous_distinct_id).toBe(mappingDistinct);
        expect(identityRow?.version).toBe("3");

        // The mapping distinct id is NOT written as its own identity row.
        const mappingRows = yield* findIdentityRows([mappingDistinct]);
        expect(mappingRows.some((row) => row.distinct_id === mappingDistinct)).toBe(false);
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "omits previous_distinct_id when the mapping distinct id equals the identity distinct id",
    withClickhouseCleanup(({ trackDistinct }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personId = uniqueId("same-person");
        const distinctId = uniqueId("same-distinct");
        trackDistinct(distinctId);

        yield* publisher.publishIdentityResult({
          identity: { distinctId },
          mappingEvents: [mappingEvent({ distinctId, personId })],
          personEvents: [],
        });

        const identityRows = yield* findIdentityRows([distinctId]);
        const identityRow = identityRows.find((row) => row.distinct_id === distinctId);
        expect(identityRow).toBeDefined();
        expect(identityRow?.distinct_id).toBe(distinctId);
        expect(identityRow?.previous_distinct_id).toBeNull();
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "writes multiple persons and identities in one batch",
    withClickhouseCleanup(({ trackDistinct, trackPerson }) =>
      Effect.gen(function* () {
        const publisher = yield* IdentityProjectionPublisher;

        const personA = uniqueId("batch-person-a");
        const personB = uniqueId("batch-person-b");
        const distinctA = uniqueId("batch-distinct-a");
        const distinctB = uniqueId("batch-distinct-b");
        trackPerson(personA);
        trackPerson(personB);
        // A single `publishIdentityResult` call carries ONE identity distinct id;
        // `toProcessorPersonIdentityEvent` rewrites every mapping whose distinctId
        // differs from it to that identity distinct id (storing the original as
        // `previous_distinct_id`). With `identity.distinctId = distinctA`, A's
        // mapping is kept as-is but B's mapping is rewritten to distinctA — so the
        // only persisted identity `distinct_id` is distinctA, and that is the only
        // id worth reclaiming (distinctB becomes a `previous_distinct_id`).
        trackDistinct(distinctA);

        yield* publisher.publishIdentityResult({
          identity: { distinctId: distinctA },
          mappingEvents: [
            // distinctId === identity.distinctId → kept, no previous distinct id,
            // version defaults to 1.
            mappingEvent({ distinctId: distinctA, personId: personA }),
            // distinctId !== identity.distinctId → rewritten to distinctA with
            // previous_distinct_id = distinctB (and version > 0 also lands
            // override + pending-override rows). version = 2.
            mappingEvent({ distinctId: distinctB, personId: personB, version: 2 }),
          ],
          personEvents: [
            personEvent({ name: "Batch A", personId: personA }),
            personEvent({ name: "Batch B", personId: personB }),
          ],
        });

        // Person rows are keyed by (project_id, person_id), so the two persons
        // land as independent rows regardless of the identity distinct id.
        const personRows = yield* findPersonRows([personA, personB]);
        expect(personRows.some((row) => row.person_id === personA)).toBe(true);
        expect(personRows.some((row) => row.person_id === personB)).toBe(true);

        // BOTH mappings are rewritten/kept to the SAME identity distinct_id
        // (distinctA), so they collide on the `person_identity_v1` sort key
        // `(project_id, distinct_id)`. The table is `ReplacingMergeTree(version)`,
        // so the two rows do NOT coexist — `FINAL` collapses them to the single
        // surviving row with the highest `version`. A's mapping is version 1 and
        // B's (rewritten) mapping is version 2, so the converged identity row is
        // B's: person_id = personB, previous_distinct_id = distinctB, version 2.
        // A's row is replaced and does not survive.
        const identityRows = yield* findIdentityRows([distinctA]);
        const survivor = identityRows.find((row) => row.distinct_id === distinctA);
        expect(survivor).toBeDefined();
        expect(survivor?.person_id).toBe(personB);
        expect(survivor?.previous_distinct_id).toBe(distinctB);
        expect(survivor?.version).toBe("2");
        // The lower-version mapping (personA, version 1) loses the dedup and is
        // not the surviving row under distinctA.
        expect(
          identityRows.some((row) => row.distinct_id === distinctA && row.person_id === personA),
        ).toBe(false);

        // distinctB is never written as its own identity row (only as a
        // previous distinct id), so a lookup by it returns nothing.
        const distinctBRows = yield* findIdentityRows([distinctB]);
        expect(distinctBRows.some((row) => row.distinct_id === distinctB)).toBe(false);
      }),
    ).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );

  test(
    "wraps a writer/ClickHouse insert failure as QueueProducerError(queueName=AnalyticsWriterService) and writes nothing",
    // No cleanup wrapper: the rejected batch lands no rows.
    Effect.gen(function* () {
      const publisher = yield* IdentityProjectionPublisher;

      // `version` maps to the `UInt64` column `version`; a negative value is
      // rejected by ClickHouse at insert time, surfacing as a SqlError
      // the writer maps to AnalyticsWriterServiceError, which the publisher in
      // turn wraps as its stable QueueProducerError. `changedAt` stays a valid
      // ISO string so `toClickhouseTimestamp` does not throw first (that would
      // be an uncaught defect, not the typed failure under test).
      const personId = uniqueId("bad-person");
      const error = yield* Effect.flip(
        publisher.publishIdentityResult({
          identity: { distinctId: uniqueId("bad-distinct") },
          mappingEvents: [],
          personEvents: [personEvent({ personId, version: -1 })],
        }),
      );

      expect(error).toBeInstanceOf(QueueProducerError);
      if (error instanceof QueueProducerError) {
        expect(error._tag).toBe("QueueProducerError");
        expect(error.queueName).toBe("AnalyticsWriterService");
      }

      // The rejected person row must not have landed.
      const personRows = yield* findPersonRows([personId]);
      expect(personRows.some((row) => row.person_id === personId)).toBe(false);
    }).pipe(Effect.provide(PublisherLayer), CoreAuthSession.authenticate()),
  );
});
