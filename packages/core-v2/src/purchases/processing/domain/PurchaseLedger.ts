import { Schema } from "effect";

/** Maximum number of terminal rows accepted by one operator replay request. */
export const MAX_PURCHASE_LEDGER_REQUEUE_IDS = 200;

export const PurchaseLedgerClaimedRow = Schema.Struct({
  attemptCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  /**
   * Claim token minted by {@link PurchaseLedgerStoreShape.claim}. Terminal
   * transitions (`publish` / `retry` / `deadLetter`) compare-and-set on it so
   * a stale worker whose claim was released and reclaimed can't overwrite the
   * new claimant's state.
   */
  claimedBy: Schema.String.check(Schema.isMinLength(1)),
  eventsPayload: Schema.Array(Schema.Unknown),
  id: Schema.String.check(Schema.isMinLength(1)),
});

/** Operator-facing forensic view of a terminal purchase-ledger row. */
export const PurchaseLedgerDeadLetterRow = Schema.Struct({
  attemptCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  createdAt: Schema.Date,
  eventsPayload: Schema.Array(Schema.Unknown),
  id: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  organizationId: Schema.String,
  personId: Schema.String,
  projectId: Schema.String,
  providerEventType: Schema.String,
  providerId: Schema.String,
  rawProviderPayload: Schema.Unknown,
  source: Schema.NullOr(Schema.String),
});

/** Health and replay counters returned by the periodic ledger sweep. */
export const PurchaseLedgerSweepResult = Schema.Struct({
  deadLetterCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  oldestOverdueAgeSeconds: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  oldestPendingAgeSeconds: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  overduePendingCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  pendingCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  requeuedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  transientCandidateCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const PurchaseLedgerWorkerPollOptions = Schema.Struct({
  batchSize: Schema.Int.check(Schema.isGreaterThan(0)),
  maxAttempts: Schema.Int.check(Schema.isGreaterThan(0)),
  staleClaimSeconds: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const PurchaseLedgerWorkerRunOptions = Schema.Struct({
  ...PurchaseLedgerWorkerPollOptions.fields,
  pollIntervalMillis: Schema.Int.check(Schema.isGreaterThan(0)),
});

export interface PurchaseLedgerWorkerPollResult {
  readonly claimedCount: number;
  readonly publishedCount: number;
  readonly retriedCount: number;
  readonly deadLetteredCount: number;
  readonly staleClaimsReleased: number;
}

export class PurchaseLedgerWorkerServiceError extends Schema.TaggedErrorClass<PurchaseLedgerWorkerServiceError>(
  "PurchaseLedgerWorkerServiceError",
)("PurchaseLedgerWorkerServiceError", { cause: Schema.String }) {}
