import { Schema } from "effect";

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
