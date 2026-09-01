import * as Schema from "effect/Schema";

export interface TransactionReconciliationFailure {
  readonly error: unknown;
  readonly transactionId: string;
}

/** Reports every transaction that failed during a reconciliation pass. */
export class ReconcileTransactionsError extends Schema.TaggedErrorClass<ReconcileTransactionsError>()(
  "ReconcileTransactionsError",
  {
    failures: Schema.Array(Schema.Struct({ error: Schema.Unknown, transactionId: Schema.String })),
    message: Schema.String,
  },
) {}
