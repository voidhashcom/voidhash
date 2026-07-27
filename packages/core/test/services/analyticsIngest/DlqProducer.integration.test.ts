/**
 * Integration tests for {@link DlqProducer}, run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB).
 *
 * `DlqProducer` is the thin processor-side adapter that turns the wire-stable
 * {@link EventProcessorDlqV1} envelopes into `analytics_ingest_dlq` rows via
 * {@link AnalyticsIngestDlqService}. The behaviour worth proving is all in the
 * *persisted* row, so every test reads the written DLQ row straight back from
 * MySQL rather than trusting the (void) return value:
 *  - `lane` → `route_class` mapping (overflow/historical pass through, anything
 *    else collapses to `main`),
 *  - the `:`-delimited `sourceOffset` suffix parsed into `source_sequence`
 *    (with a `0` fallback when the suffix is not a number),
 *  - `rawValue` JSON parsed into `payload_json` (falling back to the event
 *    itself when it is absent / unparseable),
 *  - `attempt_count` always seeded to 0,
 *  - fire-and-forget `forEach({ discard: true })` semantics: every event in a
 *    batch is written even though the producer returns void.
 *
 * Conventions: this service takes no `AuthSession` (the harness's default
 * authenticate is a no-op here but kept for parity with the other suites), and
 * the only parent row it needs — the project — is the seeded
 * {@link CoreTestFixture} container, so tests just stamp unique `captureId`s
 * (the table's UNIQUE key) per call and self-clean via {@link withDlqCleanup}.
 * The DLQ rows carry no append-only audit entries, so cleanup deletes the rows
 * alone.
 */
import { Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { DlqProducer } from "@voidhash/core/services/analyticsIngest/DlqProducer";
import { AnalyticsIngestDlqService } from "@voidhash/core/services/analyticsIngest/AnalyticsIngestDlqService";
import type { EventProcessorDlqV1 } from "@voidhash/core/domain/analyticsIngest/AnalyticsIngest";
import { Db, analyticsIngestDlq, inArray } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so capture ids stay unique even within the same millisecond. */
let seq = 0;
const uniqueCaptureId = (label: string) => `it-dlq-${label}-${Date.now()}-${seq++}`;

/**
 * Build a fully-populated {@link EventProcessorDlqV1} envelope, letting each
 * test override only the fields it asserts on. Defaults are valid wire values
 * so a test that doesn't care about, say, the lane still produces a writable row.
 */
const dlqEvent = (overrides: Partial<EventProcessorDlqV1> = {}): EventProcessorDlqV1 => ({
  captureId: uniqueCaptureId("evt"),
  distinctId: "distinct-1",
  failedAt: new Date().toISOString(),
  failureClass: "schema_rejected",
  failureId: crypto.randomUUID(),
  failureMessage: "schema validation failed",
  headers: {},
  lane: "main",
  projectId,
  schemaVersion: 1,
  sourceOffset: "topic-0:42",
  sourcePartition: 0,
  sourceTopic: "analytics.main.0",
  ...overrides,
});

/** Read a DLQ row straight from the database by its capture id (UNIQUE). */
const findDlqRowByCaptureId = (captureId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.analyticsIngestDlq.findFirst({
      where: { captureId },
    });
  });

/**
 * Delete the DLQ rows created by a test. The table carries no append-only audit
 * trail, so the rows are the only artifacts. Each delete is `ignore`d so a
 * missing row never turns the finalizer into a failure.
 */
const cleanupDlqRows = (captureIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (captureIds.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(analyticsIngestDlq)
      .where(inArray(analyticsIngestDlq.captureId, [...captureIds]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every DLQ row it writes is removed afterward, regardless
 * of how the test exits. Pass each written `captureId` to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withDlqCleanup = <E, R>(
  body: (track: (captureId: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const captureIds: string[] = [];
  return body((captureId) => {
    captureIds.push(captureId);
  }).pipe(Effect.ensuring(cleanupDlqRows(captureIds)));
};

describe("DlqProducer.dbLive publishBatch", () => {
  test(
    "maps overflow/historical lanes through and collapses everything else to main",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const overflow = dlqEvent({ captureId: uniqueCaptureId("overflow"), lane: "overflow" });
        const historical = dlqEvent({
          captureId: uniqueCaptureId("historical"),
          lane: "historical",
        });
        const main = dlqEvent({ captureId: uniqueCaptureId("main"), lane: "main" });
        const unknown = dlqEvent({ captureId: uniqueCaptureId("unknown"), lane: "unknown" });
        track(overflow.captureId!);
        track(historical.captureId!);
        track(main.captureId!);
        track(unknown.captureId!);

        yield* producer.publishBatch([overflow, historical, main, unknown]);

        const overflowRow = yield* findDlqRowByCaptureId(overflow.captureId!);
        expect(overflowRow?.routeClass).toBe("overflow");
        const historicalRow = yield* findDlqRowByCaptureId(historical.captureId!);
        expect(historicalRow?.routeClass).toBe("historical");
        const mainRow = yield* findDlqRowByCaptureId(main.captureId!);
        expect(mainRow?.routeClass).toBe("main");
        // "unknown" is not overflow/historical, so it must collapse to "main".
        const unknownRow = yield* findDlqRowByCaptureId(unknown.captureId!);
        expect(unknownRow?.routeClass).toBe("main");
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "parses the colon-delimited sourceOffset suffix into source_sequence and falls back to 0",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const numericSuffix = dlqEvent({
          captureId: uniqueCaptureId("seq-num"),
          sourceOffset: "analytics.main.0:1234",
        });
        const nonNumericSuffix = dlqEvent({
          captureId: uniqueCaptureId("seq-nan"),
          sourceOffset: "offset-without-number",
        });
        track(numericSuffix.captureId!);
        track(nonNumericSuffix.captureId!);

        yield* producer.publishBatch([numericSuffix, nonNumericSuffix]);

        const numericRow = yield* findDlqRowByCaptureId(numericSuffix.captureId!);
        expect(numericRow?.sourceSequence).toBe(1234);
        // No parseable trailing number → fallback 0.
        const fallbackRow = yield* findDlqRowByCaptureId(nonNumericSuffix.captureId!);
        expect(fallbackRow?.sourceSequence).toBe(0);
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "parses rawValue JSON into payload_json and falls back to the event when absent or unparseable",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const validJson = dlqEvent({
          captureId: uniqueCaptureId("payload-json"),
          rawValue: JSON.stringify({ marker: "decoded", nested: { ok: true } }),
        });
        const unparseable = dlqEvent({
          captureId: uniqueCaptureId("payload-bad"),
          rawValue: "{not valid json",
        });
        const absent = dlqEvent({ captureId: uniqueCaptureId("payload-absent") });
        delete (absent as { rawValue?: string }).rawValue;
        track(validJson.captureId!);
        track(unparseable.captureId!);
        track(absent.captureId!);

        yield* producer.publishBatch([validJson, unparseable, absent]);

        const decodedRow = yield* findDlqRowByCaptureId(validJson.captureId!);
        expect(decodedRow?.payloadJson).toEqual({ marker: "decoded", nested: { ok: true } });

        // Unparseable rawValue → the producer stores the original event object.
        const fallbackRow = yield* findDlqRowByCaptureId(unparseable.captureId!);
        expect((fallbackRow?.payloadJson as { failureId?: string })?.failureId).toBe(
          unparseable.failureId,
        );

        // Missing rawValue → likewise stores the original event object.
        const absentRow = yield* findDlqRowByCaptureId(absent.captureId!);
        expect((absentRow?.payloadJson as { failureId?: string })?.failureId).toBe(
          absent.failureId,
        );
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "seeds attempt_count to 0 and carries through capture/distinct/failure/shard fields",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const event = dlqEvent({
          captureId: uniqueCaptureId("fields"),
          distinctId: "distinct-fields",
          failureClass: "policy_rejected",
          failureMessage: "rejected by policy",
          sourceTopic: "analytics.main.7",
        });
        track(event.captureId!);

        yield* producer.publishBatch([event]);

        const row = yield* findDlqRowByCaptureId(event.captureId!);
        expect(row).toBeDefined();
        expect(row?.attemptCount).toBe(0);
        expect(row?.captureId).toBe(event.captureId);
        expect(row?.distinctId).toBe("distinct-fields");
        expect(row?.failureClass).toBe("policy_rejected");
        expect(row?.failureMessage).toBe("rejected by policy");
        // `sourceTopic` is recorded as the DLQ row's `source_shard`.
        expect(row?.sourceShard).toBe("analytics.main.7");
        expect(row?.projectId).toBe(projectId);
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "writes every event in a batch (fire-and-forget forEach, returns void)",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const events = Array.from({ length: 3 }, (_, i) =>
          dlqEvent({ captureId: uniqueCaptureId(`batch-${i}`) }),
        );
        for (const event of events) track(event.captureId!);

        const result = yield* producer.publishBatch(events);
        expect(result).toBeUndefined();

        for (const event of events) {
          const row = yield* findDlqRowByCaptureId(event.captureId!);
          expect(row).toBeDefined();
          expect(row?.captureId).toBe(event.captureId);
        }
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "defaults a missing projectId to 'unknown'",
    withDlqCleanup((track) =>
      Effect.gen(function* () {
        const producer = yield* DlqProducer;

        const event = dlqEvent({ captureId: uniqueCaptureId("no-project") });
        delete (event as { projectId?: string }).projectId;
        track(event.captureId!);

        yield* producer.publishBatch([event]);

        const row = yield* findDlqRowByCaptureId(event.captureId!);
        expect(row?.projectId).toBe("unknown");
      }),
    ).pipe(
      Effect.provide(DlqProducer.dbLive),
      Effect.provide(AnalyticsIngestDlqService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("DlqProducer.noop publishBatch", () => {
  test(
    "returns void and writes nothing",
    // No cleanup wrapper: the noop layer performs no DB writes.
    Effect.gen(function* () {
      const producer = yield* DlqProducer;

      const captureId = uniqueCaptureId("noop");
      const event = dlqEvent({ captureId });

      const result = yield* producer.publishBatch([event]);
      expect(result).toBeUndefined();

      const row = yield* findDlqRowByCaptureId(captureId);
      expect(row).toBeUndefined();
    }).pipe(Effect.provide(DlqProducer.noop), CoreAuthSession.authenticate()),
  );
});

// `publishBatch` wraps any `AnalyticsIngestDlqServiceError` from
// `recordFailure` in a `DlqProducerError` ("failed to record analytics ingest
// DLQ row"). Triggering that failure deterministically needs a real
// `recordFailure`/DB error, but the only failure seam is the INSERT itself:
// `routeClass`/`projectId` are always coerced to valid values and the UNIQUE
// `capture_id` collision is absorbed by `onDuplicateKeyUpdate`, so no input
// reliably makes the live PlanetScale/Vitess INSERT throw (overflow on the
// varchar columns truncates rather than errors, and is mode-dependent).
// Faking `AnalyticsIngestDlqService` to throw is disallowed (no mocks of
// services we can run). Deferred until there is an in-process fault-injection
// seam on `Db`/`AnalyticsIngestDlqService`.
vitestTest.todo(
  "DlqProducer.dbLive publishBatch wraps a recordFailure failure as DlqProducerError",
);
