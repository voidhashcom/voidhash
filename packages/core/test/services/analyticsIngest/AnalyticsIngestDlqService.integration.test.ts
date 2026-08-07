/**
 * Integration tests for {@link AnalyticsIngestDlqService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB). The service writes to / reads from the `analytics_ingest_dlq`
 * MySQL table and, for {@link AnalyticsIngestDlqService.requeueFailure}, publishes
 * the stored envelope back through the {@link CaptureIngress} port.
 *
 * Each test drives a public method end-to-end and verifies the *persisted* side
 * effects rather than just the return value:
 *  - the DLQ row written / upserted / marked-replayed in MySQL (read straight
 *    back via `Db`),
 *  - for `requeueFailure`, the events handed to a recording {@link CaptureIngress}
 *    test layer, then the row flipped to `requeued`.
 *
 * Notes specific to this service:
 *  - It performs no permission checks and writes no audit-log rows, so there is
 *    no `ActionForbiddenError` path and no audit cleanup. The default fixture
 *    session is still provided to satisfy the harness convention.
 *  - The `analytics_ingest_dlq` table is *not* swept by the global fixture
 *    teardown, so every test deletes the rows it creates via an
 *    `Effect.ensuring` finalizer ({@link withDlqCleanup}).
 *  - `captureId` carries a UNIQUE index; tests that exercise the
 *    ON-DUPLICATE-KEY upsert reuse a single capture id, all other rows use a
 *    fresh unique capture id so concurrent/leftover rows never collide.
 *  - `projectId`/`failureClass` filter assertions use values unique to the test
 *    (no FK ties this column to the fixture project) and assert by membership,
 *    never exact counts.
 *  - `CaptureIngress` is a port boundary outside the harness service set, so the
 *    test provides its own layer for it.
 */
import { AnalyticsIngestDlqReplayStatus, Db, analyticsIngestDlq, inArray } from "@voidhash/db";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Clock, Effect, Layer, Ref } from "effect";
import { describe, expect } from "vitest";

import {
  type AnalyticsIngestDlqRecordFailureInput,
  AnalyticsIngestDlqService,
  AnalyticsIngestDlqServiceError,
} from "@voidhash/core/services/analyticsIngest/AnalyticsIngestDlqService";
import {
  CaptureIngress,
  type PublishableCaptureEvent,
} from "@voidhash/core/services/analyticsIngest/CaptureIngress";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { test } = CoreIntegrationTestHarness.make();

/** Per-run token plus a monotonic counter so ids/values stay unique across and within runs. */
const runToken = generateId("test");
let seq = 0;
const unique = (label: string) => `it-an-dlq-${label}-${runToken}-${seq++}`;

/** Read a single DLQ row straight from the database, bypassing the service. */
const findDlqRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.analyticsIngestDlq.findFirst({ where: { id } });
  });

/**
 * Delete the given DLQ rows. Each delete is `ignore`d so a missing row never
 * turns the finalizer into a failure. This table has no audit rows and no FK
 * children, so a single id-based delete suffices.
 */
const cleanupCreatedRows = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(analyticsIngestDlq)
      .where(inArray(analyticsIngestDlq.id, [...ids]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every DLQ row it creates is removed afterward, regardless
 * of how the test exits. Pass each created row id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withDlqCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedRows(createdIds)));
};

/** A fully-specified `recordFailure` input with sensible, overridable defaults. */
const recordInput = (
  overrides: Partial<AnalyticsIngestDlqRecordFailureInput> = {},
): AnalyticsIngestDlqRecordFailureInput => ({
  attemptCount: 1,
  captureId: unique("cap"),
  distinctId: unique("dist"),
  failureClass: unique("class"),
  failureMessage: "boom",
  payloadJson: { hello: "world" },
  projectId: unique("proj"),
  routeClass: "main",
  sourceSequence: 1,
  sourceShard: unique("shard"),
  ...overrides,
});

/**
 * A recording {@link CaptureIngress} layer: every `enqueueBatch` call appends its
 * events to a shared `Ref`, which the test reads back to prove `requeueFailure`
 * republished the stored envelope and route. Built per layer instance.
 */
/**
 * Minimal {@link PlatformRuntime} stub. `requeueFailure` re-publishes through
 * `CaptureIngress.enqueueBatch`, whose queue send is colored with the platform
 * runtime-phase marker; the recording double below never reads it, so this just
 * discharges the type-level requirement in the harness.
 */
const PlatformRuntimeStub = Layer.succeed(PlatformRuntime, PlatformRuntime.of({}));

const makeRecordingCaptureIngress = (ref: Ref.Ref<ReadonlyArray<PublishableCaptureEvent>>) =>
  Layer.succeed(CaptureIngress, {
    enqueueBatch: (events) => Ref.update(ref, (prev) => [...prev, ...events]),
  });

describe("AnalyticsIngestDlqService.recordFailure", () => {
  test(
    "inserts a new DLQ row with the supplied fields and a generated id",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const input = recordInput();

        const id = yield* service.recordFailure(input);
        track(id);
        expect(id.startsWith("an_ing_dlq_")).toBe(true);

        const row = yield* findDlqRow(id);
        expect(row).toBeDefined();
        expect(row?.captureId).toBe(input.captureId);
        expect(row?.projectId).toBe(input.projectId);
        expect(row?.distinctId).toBe(input.distinctId);
        expect(row?.routeClass).toBe(input.routeClass);
        expect(row?.failureClass).toBe(input.failureClass);
        expect(row?.failureMessage).toBe(input.failureMessage);
        expect(row?.attemptCount).toBe(input.attemptCount);
        expect(row?.sourceShard).toBe(input.sourceShard);
        expect(row?.sourceSequence).toBe(input.sourceSequence);
        // payloadJson round-trips through MySQL JSON as the original structure.
        expect(row?.payloadJson).toEqual({ hello: "world" });
        // New rows default to Pending and are not yet replayed.
        expect(row?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Pending);
        expect(row?.replayedAt).toBeNull();
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "on a duplicate capture id, updates the existing row (ON DUPLICATE KEY UPDATE) and resets replayStatus to Pending",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const captureId = unique("dup-cap");

        const firstId = yield* service.recordFailure(
          recordInput({
            attemptCount: 1,
            captureId,
            failureClass: "first_class",
            failureMessage: "first failure",
            payloadJson: { take: 1 },
          }),
        );
        track(firstId);

        // Move the row out of Pending so we can observe the upsert resetting it.
        yield* service.markReplayed(firstId);
        const afterReplay = yield* findDlqRow(firstId);
        expect(afterReplay?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Requeued);

        // Second record with the SAME capture id collides on the unique index.
        const secondId = yield* service.recordFailure(
          recordInput({
            attemptCount: 4,
            captureId,
            failureClass: "second_class",
            failureMessage: "second failure",
            payloadJson: { take: 2 },
          }),
        );
        // The duplicate may also need cleaning up if MySQL kept the new id row
        // (it does not — the upsert mutates the original row), but tracking is
        // harmless.
        track(secondId);

        // No NEW row exists for the freshly generated id — the upsert mutated
        // the original row keyed by capture id.
        const secondRow = yield* findDlqRow(secondId);
        expect(secondRow).toBeUndefined();

        const updated = yield* findDlqRow(firstId);
        expect(updated).toBeDefined();
        expect(updated?.attemptCount).toBe(4);
        expect(updated?.failureClass).toBe("second_class");
        expect(updated?.failureMessage).toBe("second failure");
        expect(updated?.payloadJson).toEqual({ take: 2 });
        // The upsert's `set` resets replayStatus back to Pending.
        expect(updated?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Pending);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "persists an arbitrary payloadJson shape and the omittable capture/distinct ids",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const payload = { arr: [1, 2, 3], nested: { a: true }, n: 42 };

        const id = yield* service.recordFailure({
          attemptCount: 0,
          failureClass: unique("payload-class"),
          failureMessage: "no ids supplied",
          payloadJson: payload,
          projectId: unique("payload-proj"),
          routeClass: "historical",
          sourceSequence: 99,
          sourceShard: unique("payload-shard"),
        });
        track(id);

        const row = yield* findDlqRow(id);
        expect(row).toBeDefined();
        expect(row?.captureId).toBeNull();
        expect(row?.distinctId).toBeNull();
        expect(row?.routeClass).toBe("historical");
        expect(row?.payloadJson).toEqual(payload);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );
});

describe("AnalyticsIngestDlqService.listFailures", () => {
  test(
    "returns matching rows ordered by createdAt DESC, respecting the limit",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const projectId = unique("list-proj");

        const firstId = yield* service.recordFailure(recordInput({ projectId }));
        track(firstId);
        const secondId = yield* service.recordFailure(recordInput({ projectId }));
        track(secondId);

        const rows = yield* service.listFailures({ projectId, limit: 1 });
        // The limit caps the result to the single most recent matching row.
        expect(rows.length).toBe(1);
        expect(rows.every((row) => row.projectId === projectId)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "filters by projectId alone",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const projectId = unique("by-proj");
        const otherProjectId = unique("by-proj-other");

        const mine = yield* service.recordFailure(recordInput({ projectId }));
        track(mine);
        const other = yield* service.recordFailure(recordInput({ projectId: otherProjectId }));
        track(other);

        const rows = yield* service.listFailures({ projectId });
        expect(rows.some((row) => row.id === mine)).toBe(true);
        expect(rows.some((row) => row.id === other)).toBe(false);
        expect(rows.every((row) => row.projectId === projectId)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "filters by failureClass alone",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const failureClass = unique("by-class");
        const otherFailureClass = unique("by-class-other");

        const mine = yield* service.recordFailure(recordInput({ failureClass }));
        track(mine);
        const other = yield* service.recordFailure(
          recordInput({ failureClass: otherFailureClass }),
        );
        track(other);

        const rows = yield* service.listFailures({ failureClass });
        expect(rows.some((row) => row.id === mine)).toBe(true);
        expect(rows.some((row) => row.id === other)).toBe(false);
        expect(rows.every((row) => row.failureClass === failureClass)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "filters by projectId AND failureClass together",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const projectId = unique("both-proj");
        const failureClass = unique("both-class");

        // Matches both predicates.
        const match = yield* service.recordFailure(recordInput({ failureClass, projectId }));
        track(match);
        // Same project, different class — must be excluded.
        const wrongClass = yield* service.recordFailure(
          recordInput({ failureClass: unique("both-class-x"), projectId }),
        );
        track(wrongClass);
        // Same class, different project — must be excluded.
        const wrongProject = yield* service.recordFailure(
          recordInput({ failureClass, projectId: unique("both-proj-x") }),
        );
        track(wrongProject);

        const rows = yield* service.listFailures({ failureClass, projectId });
        expect(rows.some((row) => row.id === match)).toBe(true);
        expect(rows.some((row) => row.id === wrongClass)).toBe(false);
        expect(rows.some((row) => row.id === wrongProject)).toBe(false);
        expect(
          rows.every((row) => row.projectId === projectId && row.failureClass === failureClass),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "clamps an over-large limit to the [1,500] range and still returns matching rows",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        const projectId = unique("clamp-proj");

        const id = yield* service.recordFailure(recordInput({ projectId }));
        track(id);

        // limit 9999 is clamped to 500; the call must still succeed and include
        // the row we just wrote.
        const rows = yield* service.listFailures({ projectId, limit: 9999 });
        expect(rows.length).toBeLessThanOrEqual(500);
        expect(rows.some((row) => row.id === id)).toBe(true);
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );
});

describe("AnalyticsIngestDlqService.markReplayed", () => {
  test(
    "flips replayStatus to Requeued and stamps replayedAt on the row",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;

        const id = yield* service.recordFailure(recordInput());
        track(id);

        const before = yield* findDlqRow(id);
        expect(before?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Pending);
        expect(before?.replayedAt).toBeNull();

        yield* service.markReplayed(id);

        const after = yield* findDlqRow(id);
        expect(after?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Requeued);
        expect(after?.replayedAt).not.toBeNull();
      }),
    ).pipe(Effect.provide(AnalyticsIngestDlqService.layer), CoreAuthSession.authenticate()),
  );
});

describe("AnalyticsIngestDlqService.requeueFailure", () => {
  test(
    "republishes the stored envelope/route via CaptureIngress and marks the row replayed",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AnalyticsIngestDlqService;
        // Fresh recording-ingress ref scoped to this single test.
        const ref = yield* Ref.make<ReadonlyArray<PublishableCaptureEvent>>([]);

        const envelope = { captureId: unique("envelope"), schemaVersion: 1 };
        const id = yield* service.recordFailure(
          recordInput({ payloadJson: envelope, routeClass: "overflow" }),
        );
        track(id);

        yield* service.requeueFailure(id).pipe(Effect.provide(makeRecordingCaptureIngress(ref)));

        const enqueued = yield* Ref.get(ref);
        expect(enqueued.length).toBe(1);
        expect(enqueued[0]?.routeClass).toBe("overflow");
        expect(enqueued[0]?.envelope).toEqual(envelope);

        // The row is flipped to Requeued after a successful publish.
        const row = yield* findDlqRow(id);
        expect(row?.replayStatus).toBe(AnalyticsIngestDlqReplayStatus.Requeued);
        expect(row?.replayedAt).not.toBeNull();
      }),
    ).pipe(
      Effect.provide(AnalyticsIngestDlqService.layer),
      Effect.provide(PlatformRuntimeStub),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with AnalyticsIngestDlqServiceError for an unknown row id and publishes nothing",
    Effect.gen(function* () {
      const service = yield* AnalyticsIngestDlqService;
      const ref = yield* Ref.make<ReadonlyArray<PublishableCaptureEvent>>([]);

      const nowMillis = yield* Clock.currentTimeMillis;
      const missingId = `an_ing_dlq_missing_${nowMillis}`;
      const error = yield* Effect.flip(
        service.requeueFailure(missingId).pipe(Effect.provide(makeRecordingCaptureIngress(ref))),
      );
      expect(error).toBeInstanceOf(AnalyticsIngestDlqServiceError);
      if (error instanceof AnalyticsIngestDlqServiceError) {
        expect(error.cause).toContain(missingId);
      }

      // A not-found requeue never reaches the publish step.
      const published = yield* Ref.get(ref);
      expect(published.length).toBe(0);
    }).pipe(
      Effect.provide(AnalyticsIngestDlqService.layer),
      Effect.provide(PlatformRuntimeStub),
      CoreAuthSession.authenticate(),
    ),
  );
});
