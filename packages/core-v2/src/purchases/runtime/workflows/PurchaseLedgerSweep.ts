import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PurchaseLedgerStore } from "../../application/ports/PurchaseLedgerStore.ts";
import {
  MAX_PURCHASE_LEDGER_REQUEUE_IDS,
  PurchaseLedgerSweepResult,
} from "../../processing/domain/PurchaseLedger.ts";
import { PurchaseLedgerSweep } from "./definitions.ts";

const dependencies = Layer.effect(PurchaseLedgerStore, PurchaseLedgerStore);

/** Delay before an exhausted transient row begins a new retry cycle. */
export const PURCHASE_LEDGER_REQUEUE_MINIMUM_AGE_SECONDS = 6 * 60 * 60;

/** Five-minute safety net for transient ledger exhaustion and backlog alerting. */
export const PurchaseLedgerSweepRegistration = WorkflowRegistration.make(PurchaseLedgerSweep, {
  dependencies,
  cron: {
    schedule: "*/5 * * * *",
    payload: (scheduledTime) => ({ runId: scheduledTime.toISOString() }),
  },
  run: (input, ctx) =>
    ctx.step({
      name: `purchase-ledger-sweep:${input.runId}`,
      success: PurchaseLedgerSweepResult,
      execute: Effect.gen(function* () {
        const store = yield* PurchaseLedgerStore;
        const result = yield* store.sweepTransientDeadLetters({
          limit: MAX_PURCHASE_LEDGER_REQUEUE_IDS,
          minimumDeadLetterAgeSeconds: PURCHASE_LEDGER_REQUEUE_MINIMUM_AGE_SECONDS,
        });
        yield* Effect.annotateCurrentSpan({
          "voidhash.purchase_ledger.dead_letter_count": result.deadLetterCount,
          "voidhash.purchase_ledger.oldest_overdue_age_seconds": result.oldestOverdueAgeSeconds,
          "voidhash.purchase_ledger.oldest_pending_age_seconds": result.oldestPendingAgeSeconds,
          "voidhash.purchase_ledger.overdue_pending_count": result.overduePendingCount,
          "voidhash.purchase_ledger.pending_count": result.pendingCount,
          "voidhash.purchase_ledger.requeued_count": result.requeuedCount,
          "voidhash.purchase_ledger.transient_candidate_count": result.transientCandidateCount,
        });
        if (result.requeuedCount > 0 || result.deadLetterCount > 0) {
          yield* Effect.logWarning("purchase ledger sweep found delivery backlog", result);
        }
        return result;
      }),
    }),
});
