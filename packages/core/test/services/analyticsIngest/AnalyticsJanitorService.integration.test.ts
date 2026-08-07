/**
 * Integration tests for {@link AnalyticsJanitorService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * ClickHouse with the analytics database's read-write user, so the test can
 * both seed rows and assert their squashed state).
 *
 * `squash` reconciles pending identity merges in ClickHouse: it reads a backlog
 * of `person_identity_pending_overrides_v2` rows older than the safety window,
 * materialises a per-run Memory snapshot + Join temp table, bulk-`ALTER TABLE
 * UPDATE`s `events_v2.person_id` to the merged person id, deletes the squashed
 * backlog rows, then drops the temp tables. Each test drives the operation
 * end-to-end and verifies the *persisted* ClickHouse side effects.
 *
 * Conventions used throughout:
 *  - `selectBacklog` is GLOBAL (no project filter) and `events_v2` is shared by
 *    every tenant, so this suite never asserts exact backlog counts. Each test
 *    instead works under a UNIQUE `project_id` (and unique distinct ids) so its
 *    seeded rows can't collide with any other tenant's data, and asserts by
 *    membership: the seeded events were updated and the seeded backlog rows
 *    were deleted, regardless of whatever else the global squash touched.
 *  - Every test cleans up after itself in an `Effect.ensuring` finalizer that
 *    deletes the rows it wrote (events + pending overrides + any leaked temp
 *    tables) under its own `project_id`, success or failure. The fixture's
 *    container rows live in MySQL and are irrelevant here.
 *  - Temp snapshot/join table names are generated dynamically inside the
 *    service (`makeSnapshotResources`), so the test never asserts their exact
 *    names — it asserts the *effect* (events updated, backlog deleted) and that
 *    no `person_identity_pending_override_*` temp tables survive the run.
 *  - The service takes no `AuthSession`; there is no permission path to cover.
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { AnalyticsJanitorService } from "@voidhash/core/services/analyticsIngest/AnalyticsJanitorService";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";

import { constant } from "@voidhash/lib/lang";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { test } = CoreIntegrationTestHarness.make();

const EVENTS_TABLE = constant("events_v2");
const PENDING_OVERRIDES_TABLE = constant("person_identity_pending_overrides_v2");

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
/** A namespace token unique to this run so seeded rows never collide. */
const uniqueToken = (label: string) =>
  `it-janitor-${label}-${DateTime.toEpochMillis(DateTime.nowUnsafe())}-${idSeq++}`;

/**
 * Format a `Date` as a ClickHouse `DateTime64(3)` literal (`YYYY-MM-DD
 * HH:MM:SS.mmm`, UTC). Mirrors `toClickhouseTimestamp` in the analytics domain
 * so seeded `changed_at`/`event_ts` values land in the expected shape.
 */
const chTimestamp = (date: Date): string => {
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(
      date.getUTCMilliseconds(),
      3,
    )}`,
  ].join(" ");
};

interface SeededProject {
  readonly distinctId: string;
  readonly organizationId: string;
  readonly oldPersonId: string;
  readonly mergedPersonId: string;
  readonly projectId: string;
  readonly version: number;
}

/**
 * Seed one project's worth of ClickHouse state for a squash:
 *  - an `events_v2` row whose `person_id` is the pre-merge id (or null),
 *  - a `person_identity_pending_overrides_v2` row mapping
 *    `(project_id, source_distinct_id) -> mergedPersonId`, timestamped in the
 *    past so it falls before the safety-window cutoff.
 *
 * The pending row carries `version > 0` and `is_deleted = 0` so the backlog
 * selection (which keeps the latest non-deleted version per
 * project_id+source_distinct_id) picks it up.
 */
const seedProject = (
  seed: SeededProject,
  options: { readonly eventPersonId: string | null; readonly changedAt: Date },
) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    yield* ch
      .insertQuery({
        table: EVENTS_TABLE,
        values: [
          {
            event_id: `${seed.projectId}-evt-1`,
            capture_id: `${seed.projectId}-cap-1`,
            event_name: "integration_event",
            event_ts: chTimestamp(options.changedAt),
            processed_ts: chTimestamp(options.changedAt),
            organization_id: seed.organizationId,
            project_id: seed.projectId,
            distinct_id: seed.distinctId,
            previous_distinct_id: null,
            person_id: options.eventPersonId,
            identity_mode: "full",
            event_properties: "{}",
            context: "{}",
            route_lane: "main",
            skip_enrichment: 0,
            source_offset: "0",
            source_partition: 0,
            source_topic: "capture.v1",
            token: seed.projectId,
            request_path: "/i/v1/capture",
            request_id: `${seed.projectId}-req-1`,
            schema_version: 2,
          },
        ],
      })
      .pipe(Effect.asVoid);
    yield* ch
      .insertQuery({
        table: PENDING_OVERRIDES_TABLE,
        values: [
          {
            project_id: seed.projectId,
            organization_id: seed.organizationId,
            source_distinct_id: seed.distinctId,
            target_distinct_id: seed.distinctId,
            person_id: seed.mergedPersonId,
            is_deleted: 0,
            version: seed.version,
            changed_at: chTimestamp(options.changedAt),
          },
        ],
      })
      .pipe(Effect.asVoid);
  });

/**
 * Read the (single, latest) `events_v2.person_id` for a seeded project.
 *
 * No `FINAL`: the live ClickHouse Cloud `events_v2` uses the `SharedMergeTree`
 * storage, which rejects `FINAL` outright ("Storage SharedMergeTree doesn't
 * support FINAL"). It's also unnecessary here — each test seeds exactly one
 * event row under its unique `project_id`, and the squash rewrites that row in
 * place via `ALTER TABLE … UPDATE` (no new version), so the single matching row
 * is read back unambiguously. Mirrors how the sibling AnalyticsWriterService
 * integration test reads `events_v2` (plain `SELECT … WHERE …`, no `FINAL`).
 */
const findEventPersonId = (projectId: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const rows = yield* ch<{
      readonly person_id: string | null;
    }>`SELECT person_id FROM ${ch.literal(EVENTS_TABLE)}
       WHERE project_id = ${ch.param("String", projectId)}
       ORDER BY event_ts DESC
       LIMIT 1`;
    return rows[0]?.person_id ?? null;
  });

/**
 * Count the non-deleted backlog rows still present for a seeded project.
 *
 * No `FINAL`: ClickHouse Cloud's `SharedMergeTree` storage rejects it, and it
 * isn't needed — each test seeds exactly one pending-override version under its
 * unique `project_id`, and a squash physically removes the row via an
 * `ALTER TABLE … DELETE` mutation (not a tombstone insert), so an un-squashed
 * row reads back as one and a squashed row as zero without any collapse.
 */
const countPendingBacklog = (projectId: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const rows = yield* ch<{
      readonly total: string;
    }>`SELECT count() AS total FROM ${ch.literal(PENDING_OVERRIDES_TABLE)}
       WHERE project_id = ${ch.param("String", projectId)}
         AND is_deleted = 0
         AND version > 0`;
    return Number(rows[0]?.total ?? "0");
  });

/**
 * Are any per-run janitor staging table / dictionary objects left behind?
 *
 * The per-run objects `makeSnapshotResources` creates are named
 * `person_identity_pending_override_snapshot_<suffix>` (a `MergeTree` staging
 * table) and `person_identity_pending_override_dict_<suffix>` (a `Dictionary`,
 * which also surfaces in `system.tables` with engine `Dictionary`). ClickHouse
 * `LIKE` treats a bare `_` as a single-char wildcard, so the underscores in the
 * distinctive `_snapshot_`/`_dict_` infixes are escaped (`\_`) to match them
 * literally — otherwise the permanent base table
 * `person_identity_pending_overrides_v2` would also match (`override` + `s` for
 * the `_` wildcard + `_v2`) and this count would never be zero.
 */
const countLeakedSnapshotTables = () =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const rows = yield* ch<{ readonly total: string }>`SELECT count() AS total FROM system.tables
       WHERE database = currentDatabase()
         AND (
           name LIKE 'person\\_identity\\_pending\\_override\\_snapshot\\_%'
           OR name LIKE 'person\\_identity\\_pending\\_override\\_dict\\_%'
         )`;
    return Number(rows[0]?.total ?? "0");
  });

/** Delete a seeded project's ClickHouse rows (events + backlog), best-effort. */
const cleanupProject = (projectId: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    yield* ch
      .asCommand(
        ch`ALTER TABLE ${ch.literal(EVENTS_TABLE)} DELETE WHERE project_id = ${ch.param("String", projectId)} SETTINGS mutations_sync = 1`,
      )
      .pipe(Effect.ignore);
    yield* ch
      .asCommand(
        ch`ALTER TABLE ${ch.literal(PENDING_OVERRIDES_TABLE)} DELETE WHERE project_id = ${ch.param("String", projectId)} SETTINGS mutations_sync = 1`,
      )
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every project it seeds is removed afterward, regardless
 * of how the test exits. Pass each seeded `project_id` to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`.
 */
const withCleanup = <E, R>(
  body: (track: (projectId: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | ClickhouseWebClient.ClickhouseWebClient> => {
  const projectIds: string[] = [];
  return body((projectId) => {
    projectIds.push(projectId);
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        for (const projectId of projectIds) {
          yield* cleanupProject(projectId);
        }
      }),
    ),
  );
};

describe("AnalyticsJanitorService.squash", () => {
  test(
    "updates events_v2 person_ids from the backlog, deletes the squashed rows, and reports a positive duration",
    withCleanup((track) =>
      Effect.gen(function* () {
        const janitor = yield* AnalyticsJanitorService;

        const projectId = uniqueToken("squash-happy");
        const seed: SeededProject = {
          distinctId: `${projectId}-did`,
          organizationId: `${projectId}-org`,
          mergedPersonId: `${projectId}-person-merged`,
          oldPersonId: `${projectId}-person-old`,
          projectId,
          version: 4,
        };
        track(projectId);

        // changed_at is an hour in the past so a zero safety window (cutoff = now)
        // includes it in the backlog.
        const changedAt = DateTime.toDateUtc(
          DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - 60 * 60 * 1000),
        );
        yield* seedProject(seed, { changedAt, eventPersonId: seed.oldPersonId });

        const result = yield* janitor.squash({ batchSize: 10_000, safetyWindowSeconds: 0 });

        // Our event's person_id is reassigned to the merged id …
        expect(yield* findEventPersonId(projectId)).toBe(seed.mergedPersonId);
        // … our backlog row is squashed away …
        expect(yield* countPendingBacklog(projectId)).toBe(0);
        // … no per-run staging table or dictionary survives …
        expect(yield* countLeakedSnapshotTables()).toBe(0);
        // … and the run reports a valid duration and processed at least our row
        // (selectBacklog is global, so other tenants' rows may add to the count).
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.backlogRowsProcessed).toBeGreaterThanOrEqual(1);
      }),
    ).pipe(Effect.provide(AnalyticsJanitorService.layer)),
  );

  test(
    "assigns the merged person id even when the event's person_id was null (personless → identified)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const janitor = yield* AnalyticsJanitorService;

        const projectId = uniqueToken("squash-null-person");
        const seed: SeededProject = {
          distinctId: `${projectId}-did`,
          organizationId: `${projectId}-org`,
          mergedPersonId: `${projectId}-person-merged`,
          oldPersonId: `${projectId}-person-old`,
          projectId,
          version: 5,
        };
        track(projectId);

        const changedAt = DateTime.toDateUtc(
          DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - 60 * 60 * 1000),
        );
        // The event starts personless (person_id null); the squash's
        // `person_id IS NULL` predicate still matches it for reassignment.
        yield* seedProject(seed, { changedAt, eventPersonId: null });

        yield* janitor.squash({ batchSize: 10_000, safetyWindowSeconds: 0 });

        expect(yield* findEventPersonId(projectId)).toBe(seed.mergedPersonId);
        expect(yield* countPendingBacklog(projectId)).toBe(0);
      }),
    ).pipe(Effect.provide(AnalyticsJanitorService.layer)),
  );

  test(
    "skips backlog rows newer than the safety window and leaves the matching events untouched",
    withCleanup((track) =>
      Effect.gen(function* () {
        const janitor = yield* AnalyticsJanitorService;

        const projectId = uniqueToken("safety-window");
        const seed: SeededProject = {
          distinctId: `${projectId}-did`,
          organizationId: `${projectId}-org`,
          mergedPersonId: `${projectId}-person-merged`,
          oldPersonId: `${projectId}-person-old`,
          projectId,
          version: 3,
        };
        track(projectId);

        // The backlog row is recent (just now). A large safety window pushes the
        // cutoff far into the past, so this row is NEWER than the cutoff and the
        // backlog selection (`changed_at < cutoff`) must exclude it.
        yield* seedProject(seed, {
          changedAt: yield* DateTime.nowAsDate,
          eventPersonId: seed.oldPersonId,
        });

        yield* janitor.squash({ batchSize: 10_000, safetyWindowSeconds: 86_400 });

        // Our event keeps its pre-merge person id …
        const eventPersonId = yield* findEventPersonId(projectId);
        expect(eventPersonId).toBe(seed.oldPersonId);

        // … and our backlog row is untouched (not squashed away).
        expect(yield* countPendingBacklog(projectId)).toBe(1);
      }),
    ).pipe(Effect.provide(AnalyticsJanitorService.layer)),
  );

  test(
    "floors a non-positive batchSize to zero so the run touches no events but still returns a valid result",
    withCleanup((track) =>
      Effect.gen(function* () {
        const janitor = yield* AnalyticsJanitorService;

        const projectId = uniqueToken("zero-batch");
        const seed: SeededProject = {
          distinctId: `${projectId}-did`,
          organizationId: `${projectId}-org`,
          mergedPersonId: `${projectId}-person-merged`,
          oldPersonId: `${projectId}-person-old`,
          projectId,
          version: 2,
        };
        track(projectId);

        const changedAt = DateTime.toDateUtc(
          DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - 60 * 60 * 1000),
        );
        yield* seedProject(seed, { changedAt, eventPersonId: seed.oldPersonId });

        // batchSize=0 floors the `LIMIT {row_limit}` to 0 → no rows selected,
        // so the early-return path runs and nothing is mutated.
        const result = yield* janitor.squash({ batchSize: 0, safetyWindowSeconds: 0 });

        expect(result.backlogRowsProcessed).toBe(0);
        expect(typeof result.cutoffIso).toBe("string");
        expect(result.durationMs).toBeGreaterThanOrEqual(0);

        // The empty-backlog branch never creates temp tables, so none leak.
        expect(yield* countLeakedSnapshotTables()).toBe(0);

        // Our event and backlog row are both untouched.
        expect(yield* findEventPersonId(projectId)).toBe(seed.oldPersonId);
        expect(yield* countPendingBacklog(projectId)).toBe(1);
      }),
    ).pipe(Effect.provide(AnalyticsJanitorService.layer)),
  );

  vitestTest.todo(
    "wraps an underlying ClickHouse failure as AnalyticsJanitorServiceError carrying the operation context — deferred: no schema-valid input deterministically forces a ClickhouseError on the live ClickHouse Cloud instance. Both attempted triggers were tolerated rather than rejected: a far-future cutoff returns an empty backlog (squash succeeds, backlogRowsProcessed:0), and a >UInt32 batchSize (5_000_000_000 bound into LIMIT {row_limit:UInt32}) is accepted/clamped instead of parse-failing. Forcing the catchTags→AnalyticsJanitorServiceError wrap would need a fault-injecting Clickhouse double, which the integration tier forbids; cover it in the unit tier with a stubbed Clickhouse layer whose `query`/`command` fails.",
  );

  vitestTest.todo(
    "logs (but does not re-throw) a temp-table DROP failure during cleanup — deferred: cleanupSnapshotResources swallows DROP errors via Effect.logError, and there is no in-process seam to force a DROP to fail without a fault-injecting ClickHouse double, which the integration tier forbids. Verifying the swallow would need a stubbed Clickhouse layer (unit tier) where `command` selectively fails on the DROP statements.",
  );
});
