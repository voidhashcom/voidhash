/**
 * `PurchaseLedgerWorkerService` drains the `purchase_ledger` table — written
 * transactionally by `PurchaseProcessingService` — by re-dispatching each row's
 * `eventsPayload` through
 * the analytics delivery port. The ledger is the durability
 * backstop: it guarantees every revenue event is eventually dispatched even if an
 * immediate post-commit dispatch is lost.
 *
 * Driver: on the Cloudflare backend a cron-triggered `PurchaseLedgerDrainWorkflow`
 * calls `poll()` once per tick (the `run()` self-looping variant is for
 * long-running Node hosts / tests only — workerd has no persistent process).
 * Concurrency model: every drain instance calls `poll()` independently; the
 * SQL claim CAS (`FOR UPDATE SKIP LOCKED`) lets at most one of them process any
 * given row at a time. No leader election needed. Stale claims (worker crashed
 * mid-row) are swept back to `Pending` at the top of each poll.
 *
 * `AnalyticsDelivery` is edition-specific: Community persists the batch
 * synchronously, while hosted runtimes may enqueue it. Deterministic event ids
 * make the immediate-dispatch and ledger-drain overlap idempotent in both cases.
 */
import { Cause, Context, Effect, Layer, Schedule, Schema } from "effect";

import {
  AnalyticsDelivery,
  dispatchInternalAnalyticsEvents,
  InternalAnalyticsEventSchema,
} from "@voidhash/core-v2";
import { constant } from "@voidhash/lib/lang";
import {
  Db,
  PurchaseLedgerStatus,
  and,
  eq,
  isNull,
  lte,
  or,
  purchaseLedger,
  sql,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";

/**
 * Wire schema for a ledger row's `eventsPayload` — the array of trusted revenue
 * {@link InternalAnalyticsEvent}s the drain re-dispatches. Decoded inline so the
 * worker carries no dependency on the analytics-ingest dispatch internals.
 */
const LedgerAnalyticsEventsSchema = Schema.toCodecJson(Schema.Array(InternalAnalyticsEventSchema));

export class PurchaseLedgerWorkerServiceError extends Schema.TaggedErrorClass<PurchaseLedgerWorkerServiceError>(
  "PurchaseLedgerWorkerServiceError",
)("PurchaseLedgerWorkerServiceError", { cause: Schema.String }) {}

export interface PurchaseLedgerWorkerPollOptions {
  readonly batchSize: number;
  readonly maxAttempts: number;
  readonly staleClaimSeconds: number;
}

export interface PurchaseLedgerWorkerPollResult {
  readonly claimedCount: number;
  readonly publishedCount: number;
  readonly retriedCount: number;
  readonly deadLetteredCount: number;
  readonly staleClaimsReleased: number;
}

export interface PurchaseLedgerWorkerRunOptions extends PurchaseLedgerWorkerPollOptions {
  readonly pollIntervalMillis: number;
}

const DEFAULT_RUN_OPTIONS: PurchaseLedgerWorkerRunOptions = {
  batchSize: 100,
  maxAttempts: 8,
  pollIntervalMillis: 5_000,
  staleClaimSeconds: 5 * 60,
};

const MAX_BACKOFF_SECONDS = 3600;

const computeBackoffSeconds = (attemptCount: number): number =>
  Math.min(MAX_BACKOFF_SECONDS, 2 ** attemptCount);

export class PurchaseLedgerWorkerService extends Context.Service<PurchaseLedgerWorkerService>()(
  "PurchaseLedgerWorkerService",
  {
    make: Effect.gen(function* () {
      const delivery = yield* AnalyticsDelivery;
      const db = yield* Db;

      // ==================== Processing ====================

      /**
       * Processes one claimed ledger row: decodes its events payload,
       * dispatches via the analytics bridge, then marks the row published. A
       * decode failure is permanent (the row's payload doesn't match the
       * current schema) and goes straight to dead-letter. A dispatch failure
       * is transient — bump attempt count, schedule retry, or dead-letter
       * past max attempts.
       */
      const _processRow = Effect.fn("_processRow")(function* (input: {
        readonly id: string;
        readonly attemptCount: number;
        readonly eventsPayload: ReadonlyArray<object>;
        readonly maxAttempts: number;
      }) {
        yield* Effect.annotateCurrentSpan({
          "purchase_ledger.attempt_count": input.attemptCount,
          "purchase_ledger.event_count": input.eventsPayload.length,
          "purchase_ledger.id": input.id,
        });
        yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.id", input.id);
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.attempt_count",
          input.attemptCount,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.event_count",
          input.eventsPayload.length,
        );
        const decoded = yield* Schema.decodeUnknownEffect(LedgerAnalyticsEventsSchema)(
          input.eventsPayload,
        ).pipe(
          Effect.catch((decodeError) =>
            db
              .update(purchaseLedger)
              .set({
                attemptCount: input.attemptCount + 1,
                claimedAt: null,
                claimedBy: null,
                lastError: `decode failed: ${String(decodeError)}`.slice(0, 1000),
                status: PurchaseLedgerStatus.DeadLetter,
              })
              .where(eq(purchaseLedger.id, input.id))
              .pipe(Effect.as(constant("decode_failed"))),
          ),
        );
        if (decoded === "decode_failed") {
          yield* Effect.annotateCurrentSpan({ "purchase_ledger.outcome": "dead_lettered" });
          yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.outcome", "dead_lettered");
          return constant({ outcome: "dead_lettered" });
        }
        const events = decoded;
        // `matchCause` (not `match`): the queue producer can fail as a DEFECT
        // (e.g. the binding send `orDie`s) and a plain `match` would let that
        // crash the poll task instead of feeding the retry/dead-letter ladder.
        // We must NOT mark the row Published unless the batch was actually
        // enqueued onto the shared analytics-ingest queue.
        const dispatchOutcome = yield* dispatchInternalAnalyticsEvents(events).pipe(
          Effect.provideService(AnalyticsDelivery, delivery),
          Effect.matchCause({
            onFailure: (cause) => constant({ kind: "failure", error: Cause.pretty(cause) }),
            onSuccess: () => constant({ kind: "success" }),
          }),
        );
        if (dispatchOutcome.kind === "success") {
          yield* db
            .update(purchaseLedger)
            .set({
              claimedAt: null,
              claimedBy: null,
              lastError: null,
              publishedAt: sql`NOW()`,
              status: PurchaseLedgerStatus.Published,
            })
            .where(eq(purchaseLedger.id, input.id));
          yield* Effect.annotateCurrentSpan({ "purchase_ledger.outcome": "published" });
          yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.outcome", "published");
          return constant({ outcome: "published" });
        }
        const nextAttempt = input.attemptCount + 1;
        if (nextAttempt >= input.maxAttempts) {
          yield* db
            .update(purchaseLedger)
            .set({
              attemptCount: nextAttempt,
              claimedAt: null,
              claimedBy: null,
              lastError: dispatchOutcome.error.slice(0, 1000),
              status: PurchaseLedgerStatus.DeadLetter,
            })
            .where(eq(purchaseLedger.id, input.id));
          yield* Effect.annotateCurrentSpan({ "purchase_ledger.outcome": "dead_lettered" });
          yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.outcome", "dead_lettered");
          return constant({ outcome: "dead_lettered" });
        }
        // Bump `attemptCount`, push `nextAttemptAt` out by the backoff window,
        // record the error, and release the claim so the row is eligible to be
        // picked up again once the backoff elapses.
        yield* db
          .update(purchaseLedger)
          .set({
            attemptCount: nextAttempt,
            claimedAt: null,
            claimedBy: null,
            lastError: dispatchOutcome.error.slice(0, 1000),
            nextAttemptAt: sql`(NOW() + ${computeBackoffSeconds(nextAttempt)} * INTERVAL '1 second')`,
            status: PurchaseLedgerStatus.Pending,
          })
          .where(eq(purchaseLedger.id, input.id));
        yield* Effect.annotateCurrentSpan({ "purchase_ledger.outcome": "retried" });
        yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.outcome", "retried");
        return constant({ outcome: "retried" });
      });

      /**
       * One drain pass: release stale claims, claim a batch, process each
       * row sequentially. Multiple replicas calling `poll()` concurrently is
       * safe — each gets a disjoint slice via the SQL CAS.
       */
      const poll = Effect.fn("poll")(function* (
        options: PurchaseLedgerWorkerPollOptions = DEFAULT_RUN_OPTIONS,
      ) {
        const workerId = generateId("purchaseLedger");
        // Reset `InProgress` rows older than the cutoff back to `Pending` so
        // they can be re-claimed. Handles worker-crash mid-processing.
        const releasedRows = yield* db
          .update(purchaseLedger)
          .set({
            claimedAt: null,
            claimedBy: null,
            status: PurchaseLedgerStatus.Pending,
          })
          .where(
            and(
              eq(purchaseLedger.status, PurchaseLedgerStatus.InProgress),
              lte(
                purchaseLedger.claimedAt,
                sql`(NOW() - ${options.staleClaimSeconds} * INTERVAL '1 second')`,
              ),
            ),
          )
          .returning({ id: purchaseLedger.id });
        const released = releasedRows.length;
        // Claim up to `batchSize` pending rows for `workerId`. The subquery
        // selects eligible rows with `FOR UPDATE SKIP LOCKED`, so concurrent
        // pollers never contend for the same row (each skips rows another worker
        // has already locked); the trailing `status = Pending` guard is
        // belt-and-suspenders for the CAS update.
        yield* db
          .update(purchaseLedger)
          .set({
            claimedAt: sql`NOW()`,
            claimedBy: workerId,
            status: PurchaseLedgerStatus.InProgress,
          })
          .where(
            and(
              eq(purchaseLedger.status, PurchaseLedgerStatus.Pending),
              or(
                isNull(purchaseLedger.nextAttemptAt),
                lte(purchaseLedger.nextAttemptAt, sql`NOW()`),
              ),
              sql`${purchaseLedger.id} IN (
                  SELECT id FROM ${purchaseLedger}
                  WHERE ${purchaseLedger.status} = ${PurchaseLedgerStatus.Pending}
                    AND (${purchaseLedger.nextAttemptAt} IS NULL OR ${purchaseLedger.nextAttemptAt} <= NOW())
                  ORDER BY ${purchaseLedger.createdAt} ASC
                  LIMIT ${options.batchSize}
                  FOR UPDATE SKIP LOCKED
                )`,
            ),
          );
        const claimed = yield* db.query.purchaseLedger.findMany({
          where: {
            status: PurchaseLedgerStatus.InProgress,
            claimedBy: workerId,
          },
        });
        let publishedCount = 0;
        let retriedCount = 0;
        let deadLetteredCount = 0;
        for (const row of claimed) {
          const { outcome } = yield* _processRow({
            attemptCount: row.attemptCount,
            eventsPayload: row.eventsPayload,
            id: row.id,
            maxAttempts: options.maxAttempts,
          });
          if (outcome === "published") publishedCount++;
          else if (outcome === "retried") retriedCount++;
          else deadLetteredCount++;
        }
        const result: PurchaseLedgerWorkerPollResult = {
          claimedCount: claimed.length,
          deadLetteredCount,
          publishedCount,
          retriedCount,
          staleClaimsReleased: released,
        };
        yield* Effect.annotateCurrentSpan({
          "purchase_ledger.claimed_count": result.claimedCount,
          "purchase_ledger.dead_lettered_count": result.deadLetteredCount,
          "purchase_ledger.published_count": result.publishedCount,
          "purchase_ledger.retried_count": result.retriedCount,
          "purchase_ledger.stale_claims_released": result.staleClaimsReleased,
        });
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.claimed_count",
          result.claimedCount,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.published_count",
          result.publishedCount,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.retried_count",
          result.retriedCount,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.dead_lettered_count",
          result.deadLetteredCount,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.purchase_ledger.stale_claims_released",
          result.staleClaimsReleased,
        );
        return result;
      });

      /**
       * Long-running `Effect.repeat(poll, Schedule.spaced(...))`. Wire via
       * `Layer.scopedDiscard` + `Effect.forkScoped` in app composition so
       * the fiber is tied to the app's scope (cleanly cancelled on
       * shutdown). Errors in `poll` are logged and swallowed so a transient
       * DB hiccup doesn't kill the worker loop.
       */
      const run = Effect.fn("run")(function* (
        options: PurchaseLedgerWorkerRunOptions = DEFAULT_RUN_OPTIONS,
      ) {
        return yield* poll(options).pipe(
          Effect.catch((cause) => Effect.logError("purchase-ledger worker poll failed", cause)),
          Effect.repeat(Schedule.spaced(`${options.pollIntervalMillis} millis`)),
        );
      });

      return constant({
        poll,
        run,
      });
    }),
  },
) {
  static readonly layer = Layer.effect(PurchaseLedgerWorkerService)(
    PurchaseLedgerWorkerService.make,
  );
}
