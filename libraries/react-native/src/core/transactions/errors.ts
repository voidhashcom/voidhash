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

/** A restored receipt remains queued because the server has not accepted it. */
export class TransactionDeliveryDeferredError extends Schema.TaggedErrorClass<TransactionDeliveryDeferredError>()(
  "TransactionDeliveryDeferredError",
  { message: Schema.String, transactionId: Schema.String },
) {}
