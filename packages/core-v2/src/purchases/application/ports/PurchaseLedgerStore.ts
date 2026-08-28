import { Context, type Effect } from "effect";

import type {
  PurchaseLedgerClaimedRow,
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
}

export class PurchaseLedgerStore extends Context.Service<
  PurchaseLedgerStore,
  PurchaseLedgerStoreShape
>()("@voidhash/core-v2/purchases/PurchaseLedgerStore") {}
