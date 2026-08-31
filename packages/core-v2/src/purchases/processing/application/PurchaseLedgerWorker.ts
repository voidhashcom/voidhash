import { Cause, Context, Effect, Layer, Schedule, Schema } from "effect";

import { PurchaseLedgerStore } from "../../application/ports/PurchaseLedgerStore.ts";
import { RevenueEventSink } from "../../application/ports/RevenueEventSink.ts";
import { RevenueEventSchema } from "../../contract/RevenueEvents.ts";
import {
  PurchaseLedgerWorkerServiceError,
  PurchaseLedgerWorkerPollOptions,
  PurchaseLedgerWorkerRunOptions,
  type PurchaseLedgerClaimedRow,
  type PurchaseLedgerWorkerPollResult,
} from "../domain/PurchaseLedger.ts";

const LedgerRevenueEvents = Schema.toCodecJson(Schema.Array(RevenueEventSchema));

export const DEFAULT_PURCHASE_LEDGER_RUN_OPTIONS: typeof PurchaseLedgerWorkerRunOptions.Type = {
  batchSize: 100,
  maxAttempts: 50,
  pollIntervalMillis: 5_000,
  staleClaimSeconds: 5 * 60,
};

const DEAD_LETTERED = "dead_lettered";
const PUBLISHED = "published";
const RETRIED = "retried";

type DeliveryResult =
  | { readonly error: string; readonly ok: false }
  | { readonly deadLettered: number; readonly ok: true; readonly stored: number };

const makePurchaseLedgerWorker = Effect.gen(function* () {
  const sink = yield* RevenueEventSink;
  const store = yield* PurchaseLedgerStore;

  const processRow = Effect.fn("PurchaseLedgerWorker.processRow")(function* (
    row: typeof PurchaseLedgerClaimedRow.Type,
    maxAttempts: number,
  ) {
    yield* Effect.annotateCurrentSpan({
      "purchase_ledger.attempt_count": row.attemptCount,
      "purchase_ledger.event_count": row.eventsPayload.length,
      "purchase_ledger.id": row.id,
    });

    const decoded = yield* Schema.decodeUnknownEffect(LedgerRevenueEvents)(row.eventsPayload).pipe(
      Effect.catch((error) =>
        store
          .deadLetter({
            attemptCount: row.attemptCount + 1,
            claimedBy: row.claimedBy,
            id: row.id,
            lastError: `decode failed: ${String(error)}`.slice(0, 1_000),
          })
          .pipe(Effect.as(null)),
      ),
    );
    if (decoded === null) return DEAD_LETTERED;
    if (decoded.length === 0) {
      yield* store.publish({ claimedBy: row.claimedBy, id: row.id });
      return PUBLISHED;
    }

    const delivered = yield* sink.deliver(decoded).pipe(
      Effect.matchCause({
        onFailure: (cause) => ({ error: Cause.pretty(cause), ok: false }) satisfies DeliveryResult,
        onSuccess: (outcome) => ({ ok: true, ...outcome }) satisfies DeliveryResult,
      }),
    );
    if (delivered.ok && delivered.deadLettered === 0 && delivered.stored === decoded.length) {
      yield* store.publish({ claimedBy: row.claimedBy, id: row.id });
      return PUBLISHED;
    }

    let deliveryError: string;
    if (delivered.ok) {
      deliveryError = `delivery incomplete: stored ${delivered.stored}/${decoded.length}, dead-lettered ${delivered.deadLettered}`;
    } else {
      deliveryError = delivered.error;
    }

    const nextAttempt = row.attemptCount + 1;
    if (nextAttempt >= maxAttempts) {
      yield* store.deadLetter({
        attemptCount: nextAttempt,
        claimedBy: row.claimedBy,
        id: row.id,
        lastError: deliveryError.slice(0, 1_000),
      });
      return DEAD_LETTERED;
    }

    yield* store.retry({
      attemptCount: nextAttempt,
      backoffSeconds: Math.min(3_600, 2 ** nextAttempt),
      claimedBy: row.claimedBy,
      id: row.id,
      lastError: deliveryError.slice(0, 1_000),
    });
    return RETRIED;
  });

  const poll = (
    options: typeof PurchaseLedgerWorkerPollOptions.Type = DEFAULT_PURCHASE_LEDGER_RUN_OPTIONS,
  ) =>
    Effect.gen(function* () {
      const decodedOptions = yield* Schema.decodeUnknownEffect(PurchaseLedgerWorkerPollOptions)(
        options,
      );
      const claimed = yield* store.claim(decodedOptions);
      let publishedCount = 0;
      let retriedCount = 0;
      let deadLetteredCount = 0;

      for (const row of claimed.rows) {
        const outcome = yield* processRow(row, decodedOptions.maxAttempts);
        if (outcome === PUBLISHED) publishedCount++;
        else if (outcome === RETRIED) retriedCount++;
        else deadLetteredCount++;
      }

      const result: PurchaseLedgerWorkerPollResult = {
        claimedCount: claimed.rows.length,
        deadLetteredCount,
        publishedCount,
        retriedCount,
        staleClaimsReleased: claimed.staleClaimsReleased,
      };
      yield* Effect.annotateCurrentSpan({
        "purchase_ledger.claimed_count": result.claimedCount,
        "purchase_ledger.dead_lettered_count": result.deadLetteredCount,
        "purchase_ledger.published_count": result.publishedCount,
        "purchase_ledger.retried_count": result.retriedCount,
        "purchase_ledger.stale_claims_released": result.staleClaimsReleased,
      });
      return result;
    }).pipe(
      Effect.mapError((error) => new PurchaseLedgerWorkerServiceError({ cause: String(error) })),
      Effect.withSpan("PurchaseLedgerWorker.poll"),
    );

  const run = (
    options: typeof PurchaseLedgerWorkerRunOptions.Type = DEFAULT_PURCHASE_LEDGER_RUN_OPTIONS,
  ) =>
    Schema.decodeUnknownEffect(PurchaseLedgerWorkerRunOptions)(options).pipe(
      Effect.mapError((error) => new PurchaseLedgerWorkerServiceError({ cause: String(error) })),
      Effect.flatMap((decodedOptions) =>
        poll(decodedOptions).pipe(
          Effect.catch((cause) => Effect.logError("purchase-ledger worker poll failed", cause)),
          Effect.repeat(Schedule.spaced(`${decodedOptions.pollIntervalMillis} millis`)),
        ),
      ),
      Effect.withSpan("PurchaseLedgerWorker.run"),
    );

  return { poll, run };
});

export type PurchaseLedgerWorkerShape = Effect.Success<typeof makePurchaseLedgerWorker>;

export class PurchaseLedgerWorker extends Context.Service<
  PurchaseLedgerWorker,
  PurchaseLedgerWorkerShape
>()("@voidhash/core-v2/purchases/PurchaseLedgerWorker", { make: makePurchaseLedgerWorker }) {
  static readonly DEFAULT_RUN_OPTIONS = DEFAULT_PURCHASE_LEDGER_RUN_OPTIONS;
  static readonly layer = Layer.effect(PurchaseLedgerWorker)(PurchaseLedgerWorker.make);
}
