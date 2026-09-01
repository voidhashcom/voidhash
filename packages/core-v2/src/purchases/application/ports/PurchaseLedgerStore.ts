import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type {
  PurchaseLedgerClaimedRow,
  PurchaseLedgerDeadLetterRow,
  PurchaseLedgerSweepResult,
  PurchaseLedgerWorkerPollOptions,
} from "../../processing/domain/PurchaseLedger.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface PurchaseLedgerStoreShape {
  readonly claim: (options: typeof PurchaseLedgerWorkerPollOptions.Type) => Effect.Effect<
    {
      readonly rows: ReadonlyArray<typeof PurchaseLedgerClaimedRow.Type>;
      readonly staleClaimsReleased: number;
    },
    PurchasePortError
  >;
  readonly deadLetter: (input: {
    readonly id: string;
    readonly claimedBy: string;
    readonly attemptCount: number;
    readonly lastError: string;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly publish: (input: {
    readonly id: string;
    readonly claimedBy: string;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly retry: (input: {
    readonly id: string;
    readonly claimedBy: string;
    readonly attemptCount: number;
    readonly backoffSeconds: number;
    readonly lastError: string;
  }) => Effect.Effect<void, PurchasePortError>;
  /** Lists terminal rows for operator inspection, oldest first. */
  readonly listDeadLetters: (input: {
    readonly limit: number;
    readonly offset: number;
  }) => Effect.Effect<
    {
      readonly items: ReadonlyArray<typeof PurchaseLedgerDeadLetterRow.Type>;
      readonly total: number;
    },
    PurchasePortError
  >;
  /** Explicitly requeues selected terminal rows, including poison rows. */
  readonly requeueDeadLetters: (input: {
    readonly ids: ReadonlyArray<string>;
  }) => Effect.Effect<number, PurchasePortError>;
  /** Requeues bounded non-poison dead letters and reports current backlog health. */
  readonly sweepTransientDeadLetters: (input: {
    readonly limit: number;
    /** Minimum terminal age before an exhausted row is automatically retried. */
    readonly minimumDeadLetterAgeSeconds: number;
  }) => Effect.Effect<typeof PurchaseLedgerSweepResult.Type, PurchasePortError>;
}

export class PurchaseLedgerStore extends Context.Service<
  PurchaseLedgerStore,
  PurchaseLedgerStoreShape
>()("@voidhash/core-v2/purchases/PurchaseLedgerStore") {}
