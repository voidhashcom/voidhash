import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface PurchaseLedgerReservation {
  readonly id: string;
}

export type PurchaseLedgerReservationResult =
  | { readonly _tag: "reserved"; readonly reservation: PurchaseLedgerReservation }
  | { readonly _tag: "duplicate"; readonly result: PurchaseProcessingResult };

export interface PurchaseLedgerReserveInput {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly organizationId: string;
  readonly personId: string;
  readonly projectId: string;
  readonly providerEventType: string;
  readonly providerId: string;
  readonly rawProviderPayload: unknown;
  readonly source: string;
}

export interface PurchaseLedgerWriteStoreShape {
  readonly reserve: (
    input: PurchaseLedgerReserveInput,
  ) => Effect.Effect<PurchaseLedgerReservationResult, PurchasePortError>;
  readonly finalize: (input: {
    readonly reservation: PurchaseLedgerReservation;
    readonly result: PurchaseProcessingResult;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly stageEvents: (input: {
    readonly events: ReadonlyArray<RevenueEvent>;
    readonly reservation: PurchaseLedgerReservation;
    readonly result: PurchaseProcessingResult;
  }) => Effect.Effect<void, PurchasePortError>;
}

/** Transaction-bound write side of the durable purchase outbox. */
export class PurchaseLedgerWriteStore extends Context.Service<
  PurchaseLedgerWriteStore,
  PurchaseLedgerWriteStoreShape
>()("@voidhash/core-v2/purchases/PurchaseLedgerWriteStore") {}
