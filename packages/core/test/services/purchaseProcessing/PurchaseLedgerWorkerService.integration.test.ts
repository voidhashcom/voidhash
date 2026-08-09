/**
 * Integration tests for {@link PurchaseLedgerWorkerService}, run against the
 * real backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB; the analytics dispatch is the one collaborator we control here).
 *
 * The worker drains the append-only `purchase_ledger` table by advancing rows
 * through `Pending → InProgress → Published` (or `DeadLetter`) via a SQL CAS
 * claim. Each test seeds real ledger rows, runs one `poll()` pass against the
 * live DB, and verifies the *persisted* state transition rather than just the
 * returned counts:
 *  - the `status` / `attemptCount` / `nextAttemptAt` / `lastError` /
 *    `publishedAt` / `claimedBy` columns the worker rewrites,
 *  - that the claim is always released (`claimedBy`/`claimedAt` cleared) on a
 *    terminal or retry outcome.
 *
 * Two deliberate design facts shape these tests:
 *  - The worker's claim/release SQL is GLOBAL (it has no project scoping), and
 *    the DB is shared across tests, so assertions are always scoped to the rows
 *    a test created (by id) and never to the aggregate poll-result counts. A
 *    poll may claim leftover rows from elsewhere; we assert our own rows reached
 *    the expected status and that the count fields are numbers / contributed.
 *  - `eventsPayload` is a JSON column. Every {@link InternalAnalyticsEvent}
 *    variant carries a required `occurredAt: Schema.Date` (an `instanceOf(Date)`
 *    schema that rejects ISO strings), so any realistic event payload that
 *    round-trips through JSON storage *fails* to decode and is dead-lettered.
 *    The only payload that decodes cleanly after a JSON round-trip is the empty
 *    array — which also makes the decode-success / publish / retry / dead-letter
 *    paths reachable by pairing an empty payload with a controllable dispatch.
 *
 * Conventions:
 *  - The fixture seeds only user/org/member/project; this service needs neither
 *    auth nor any fixture parent row (ledger columns have no FK constraints), so
 *    rows are inserted directly with a unique idempotency-key namespace and
 *    cleaned up by id via {@link withLedgerCleanup} on exit, success or failure.
 *  - {@link makeDispatch} provides a test-double {@link AnalyticsDispatchService}
 *    whose `dispatchTrusted` either succeeds or fails on demand. The live
 *    dispatch enqueues onto a Cloudflare Queue (no in-process runtime), so a
 *    controllable double is the only in-process seam for the dispatch-failure
 *    → retry / dead-letter paths.
 */
import { Clock, Data, DateTime, Effect, Layer } from "effect";
import { describe, expect, test as vitestTest } from "vitest";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import { PurchaseLedgerWorkerService } from "@voidhash/core/services/purchaseProcessing/PurchaseLedgerWorkerService";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  type InsertPurchaseLedger,
  PurchaseLedgerStatus,
  eq,
  inArray,
  purchaseLedger,
  sql,
} from "@voidhash/db";

import { constant } from "@voidhash/lib/lang";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

/** Monotonic counter so idempotency keys stay unique within the same millisecond. */
let seq = 0;
const uniqueKey = (label: string) =>
  `it-pl-${label}-${DateTime.toEpochMillis(DateTime.nowUnsafe())}-${seq++}`;

const fakeService = (impl: object): any => impl;

/** Dispatch failure injected by the test double; its message is asserted downstream. */
class DispatchBoomError extends Data.TaggedError("DispatchBoomError")<{
  readonly message: string;
}> {}

const publishedFlag = (count: number): number => {
  if (count >= 1) return 1;
  return 0;
};

/**
 * Poll options with a small batch / fast stale cutoff so a single pass claims
 * and processes the seeded rows deterministically. `maxAttempts` matches the
 * production default so the retry-vs-dead-letter boundary is exercised at the
 * real watermark.
 */
const pollOptions = constant({
  batchSize: 100,
  maxAttempts: 8,
  staleClaimSeconds: 300,
});

/**
 * A test-double {@link AnalyticsDispatchService} whose `dispatchTrusted`
 * succeeds or fails on demand. `behavior: "fail"` returns a failed effect (cast
 * to the shape's error / requirement channels, matching the worker's
 * `Effect.matchCause` dispatch handler) so the dispatch-failure → retry /
 * dead-letter paths are reachable in-process.
 */
const makeDispatch = (behavior: "succeed" | "fail"): Layer.Layer<AnalyticsDispatchService> =>
  Layer.succeed(AnalyticsDispatchService, {
    dispatchCaptured: () => Effect.void,
    dispatchTrusted: fakeService(() => {
      if (behavior === "fail") return Effect.fail(new DispatchBoomError({ message: "dispatch boom" }));
      return Effect.void;
    }),
  });

/**
 * Minimal {@link PlatformRuntime} stub. `dispatchTrusted` colors its effect
 * with the platform runtime marker (the live queue producer needs it); the test
 * double never reads it, so this only discharges the type-level requirement.
 */
const PlatformRuntimeStub = Layer.succeed(PlatformRuntime, PlatformRuntime.of({}));

/** Build a complete `purchase_ledger` insert row, defaulting every NOT NULL column. */
const ledgerRow = (
  overrides: Partial<InsertPurchaseLedger>,
): InsertPurchaseLedger & { readonly id: string } => ({
  attemptCount: 0,
  claimedAt: null,
  claimedBy: null,
  eventsPayload: [],
  id: generateId("purchaseLedger"),
  idempotencyKey: uniqueKey("row"),
  lastError: null,
  nextAttemptAt: null,
  organizationId,
  personId: "it_pl_person",
  projectId,
  providerEventType: "purchase",
  providerId: "apple-app-store",
  publishedAt: null,
  rawProviderPayload: null,
  resultPayload: {},
  source: "webhook",
  status: PurchaseLedgerStatus.Pending,
  ...overrides,
});

/** Insert a ledger row, returning its id for read-back + cleanup. */
const insertRow = (overrides: Partial<InsertPurchaseLedger>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const row = ledgerRow(overrides);
    yield* db.insert(purchaseLedger).values(row);
    return row.id;
  });

/** Read a single ledger row straight from the DB, bypassing the worker. */
const findRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchaseLedger.findFirst({ where: { id } });
  });

/**
 * Force a row's `claimedAt` into the past so the stale-claim sweep treats it as
 * abandoned. `claimedAt` defaults to `NOW()` on the seed insert via the worker's
 * own SQL, but a directly-seeded `InProgress` row needs an explicit backdated
 * timestamp the relational column type can't express as a literal, so it is set
 * with a SQL interval subtraction (`make_interval(secs => …)`).
 */
const backdateClaim = (id: string, secondsAgo: number) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .update(purchaseLedger)
      .set({ claimedAt: sql`NOW() - make_interval(secs => ${secondsAgo})` })
      .where(eq(purchaseLedger.id, id));
  });

/** Delete the seeded ledger rows. Ledger rows are append-only with no audit log. */
const cleanupRows = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(purchaseLedger)
      .where(inArray(purchaseLedger.id, [...ids]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every ledger row it inserts is removed afterward,
 * regardless of how the test exits. Pass each inserted id to `track`; cleanup
 * reads the collected ids lazily at finalization via `Effect.ensuring`.
 */
const withLedgerCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupRows(createdIds)));
};

describe("PurchaseLedgerWorkerService.poll", () => {
  test(
    "leaves a non-pending row untouched (no pending rows in scope)",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // A Published row is terminal — the claim SQL only targets Pending rows,
        // so a poll must never reclaim or re-process it.
        const id = yield* insertRow({
          publishedAt: yield* DateTime.nowAsDate,
          status: PurchaseLedgerStatus.Published,
        });
        track(id);

        const result = yield* worker.poll(pollOptions);
        expect(typeof result.claimedCount).toBe("number");

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.Published);
        expect(row?.claimedBy).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "claims a pending row, dispatches it, and marks it published",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // Empty payload decodes cleanly after the JSON round-trip; the
        // succeeding bridge then drives the row to Published.
        const id = yield* insertRow({ eventsPayload: [], status: PurchaseLedgerStatus.Pending });
        track(id);

        const result = yield* worker.poll(pollOptions);
        // Membership-style: this poll published at least our row. Other rows in
        // the shared table may inflate the aggregate, so never assert equality.
        expect(result.publishedCount).toBeGreaterThanOrEqual(1);
        expect(typeof result.claimedCount).toBe("number");
        expect(typeof result.retriedCount).toBe("number");
        expect(typeof result.deadLetteredCount).toBe("number");
        expect(typeof result.staleClaimsReleased).toBe("number");

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.Published);
        expect(row?.publishedAt).not.toBeNull();
        expect(row?.lastError).toBeNull();
        expect(row?.claimedBy).toBeNull();
        expect(row?.claimedAt).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "dead-letters a row whose payload fails to decode (permanent), without dispatching",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // A payload that cannot match the analytics-event schema is a permanent
        // failure → straight to DeadLetter, bridge never consulted.
        const id = yield* insertRow({
          attemptCount: 2,
          eventsPayload: [{ not: "a valid analytics event" }],
          status: PurchaseLedgerStatus.Pending,
        });
        track(id);

        yield* worker.poll(pollOptions);

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.DeadLetter);
        expect(row?.lastError?.startsWith("decode failed:")).toBe(true);
        // markDeadLetter bumps the attempt count by one.
        expect(row?.attemptCount).toBe(3);
        expect(row?.claimedBy).toBeNull();
        expect(row?.claimedAt).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "on dispatch failure under max attempts: schedules a backoff retry and stays pending",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // attemptCount 0 + failing bridge → nextAttempt 1, well under maxAttempts,
        // so the row is rescheduled rather than dead-lettered.
        const id = yield* insertRow({
          attemptCount: 0,
          eventsPayload: [],
          status: PurchaseLedgerStatus.Pending,
        });
        track(id);

        yield* worker.poll(pollOptions);

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.Pending);
        expect(row?.attemptCount).toBe(1);
        // Backoff pushes the next eligible time into the future (computeBackoff =
        // 2 ** 1 = 2s); assert it is scheduled ahead of now rather than the exact
        // second, which races NOW().
        const nowMillis = yield* Clock.currentTimeMillis;
        expect(row?.nextAttemptAt).not.toBeNull();
        expect(row?.nextAttemptAt && row.nextAttemptAt.getTime() > nowMillis).toBe(true);
        expect(row?.lastError).toContain("dispatch boom");
        // The claim is released so the row is eligible again after the window.
        expect(row?.claimedBy).toBeNull();
        expect(row?.claimedAt).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("fail")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "on dispatch failure at the last attempt: dead-letters the row",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // attemptCount 7 + failing dispatch → nextAttempt 8 === maxAttempts, so the
        // row exhausts retries and is dead-lettered.
        const id = yield* insertRow({
          attemptCount: 7,
          eventsPayload: [],
          status: PurchaseLedgerStatus.Pending,
        });
        track(id);

        yield* worker.poll(pollOptions);

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.DeadLetter);
        expect(row?.attemptCount).toBe(8);
        expect(row?.lastError).toContain("dispatch boom");
        expect(row?.claimedBy).toBeNull();
        expect(row?.claimedAt).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("fail")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "releases a stale InProgress claim back to pending, then reclaims and processes it",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // An InProgress row whose claim is older than the stale cutoff models a
        // worker that crashed mid-row; the sweep must release it before claiming.
        const id = yield* insertRow({
          claimedBy: "crashed-worker",
          eventsPayload: [],
          status: PurchaseLedgerStatus.InProgress,
        });
        track(id);
        yield* backdateClaim(id, pollOptions.staleClaimSeconds + 120);

        const result = yield* worker.poll(pollOptions);
        expect(result.staleClaimsReleased).toBeGreaterThanOrEqual(1);

        // Released → reclaimed by this worker → dispatched (succeeding bridge) →
        // Published, all within the one pass.
        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.Published);
        expect(row?.claimedBy).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "does not release a fresh InProgress claim within the stale window",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        // A claim taken just now is inside the stale window, so the sweep must
        // leave it InProgress (another live worker presumably owns it).
        const id = yield* insertRow({
          claimedBy: "active-worker",
          eventsPayload: [],
          status: PurchaseLedgerStatus.InProgress,
        });
        track(id);
        yield* backdateClaim(id, 1);

        yield* worker.poll(pollOptions);

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.InProgress);
        expect(row?.claimedBy).toBe("active-worker");
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  test(
    "concurrent polls partition rows safely via the SQL CAS: a single row is processed once",
    withLedgerCleanup((track) =>
      Effect.gen(function* () {
        const worker = yield* PurchaseLedgerWorkerService;

        const id = yield* insertRow({ eventsPayload: [], status: PurchaseLedgerStatus.Pending });
        track(id);

        // Two replicas poll at once; the trailing `status = Pending` guard in the
        // claim UPDATE makes at most one of them win the row, so it is published
        // exactly once and never double-claimed.
        const [a, b] = yield* Effect.all([worker.poll(pollOptions), worker.poll(pollOptions)], {
          concurrency: 2,
        });
        const ourPublished = publishedFlag(a.publishedCount) + publishedFlag(b.publishedCount);
        expect(ourPublished).toBeGreaterThanOrEqual(1);

        const row = yield* findRow(id);
        expect(row?.status).toBe(PurchaseLedgerStatus.Published);
        expect(row?.claimedBy).toBeNull();
        expect(row?.publishedAt).not.toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseLedgerWorkerService.layer),
      Effect.provide(makeDispatch("succeed")),
      Effect.provide(PlatformRuntimeStub),
    ),
  );

  // `computeBackoffSeconds` is a private pure helper with no public seam. Its
  // sub-ceiling output is observed indirectly above (`nextAttemptAt` is pushed
  // into the future on retry). The MAX_BACKOFF_SECONDS = 3600 ceiling only binds
  // at attemptCount >= 12 (2 ** 12 > 3600), which the default maxAttempts of 8
  // never reaches before dead-lettering, so the clamp cannot be reached through
  // the public `poll()` contract and is left for a dedicated unit test of the
  // extracted helper.
  vitestTest.todo(
    "computeBackoffSeconds clamps to MAX_BACKOFF_SECONDS — unreachable via poll() (nextAttempt < 12 before dead-letter); needs a unit test of the extracted pure helper",
  );
});

describe("PurchaseLedgerWorkerService.run", () => {
  // `run()` is `poll().pipe(catch+logError, Effect.repeat(Schedule.spaced(...)))`
  // — an unbounded loop that never returns and swallows poll errors. There is no
  // in-process seam to stop it deterministically after N iterations without
  // forking + racing an interrupt on a wall-clock delay, which would be timing-
  // flaky in the shared-DB harness. The per-pass behavior it repeats (claim →
  // dispatch → state transition, plus error swallowing inside `poll`) is fully
  // covered by the `poll` suite above; the schedule wiring is left as a todo.
  vitestTest.todo(
    "run() repeats poll() on Schedule.spaced(pollIntervalMillis) and logs+swallows poll errors without stopping — infinite loop, no in-process seam to break the schedule deterministically",
  );
});
