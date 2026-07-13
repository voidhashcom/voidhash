import { Data } from "effect";

export interface TransactionReconciliationFailure {
  readonly error: unknown;
  readonly transactionId: string;
}

/** Reports every transaction that failed during a reconciliation pass. */
export class ReconcileTransactionsError extends Data.TaggedError("ReconcileTransactionsError")<{
  readonly failures: ReadonlyArray<TransactionReconciliationFailure>;
  readonly message: string;
}> {}
