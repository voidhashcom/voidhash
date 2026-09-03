import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { EntitlementSync } from "./EntitlementSync.ts";
import type { PurchaseLedgerWriteStore } from "./PurchaseLedgerWriteStore.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";
import type { PurchaseStateRepository } from "./PurchaseStateRepository.ts";
import type { PurchaseWebhookOutbox } from "./PurchaseWebhookOutbox.ts";

export type PurchaseTxServices =
  | PurchaseStateRepository
  | PurchaseLedgerWriteStore
  | EntitlementSync
  | PurchaseWebhookOutbox;

export interface PurchaseUnitOfWorkShape {
  readonly transact: <A, E>(
    effect: Effect.Effect<A, E, PurchaseTxServices>,
  ) => Effect.Effect<A, E | PurchasePortError>;
}

/** Runs purchase persistence, entitlement sync, ledger and webhook outbox staging atomically. */
export class PurchaseUnitOfWork extends Context.Service<
  PurchaseUnitOfWork,
  PurchaseUnitOfWorkShape
>()("@voidhash/core-v2/purchases/PurchaseUnitOfWork") {}
