import { Context, type Effect } from "effect";

import type { FxRateLookup, FxRateWrite } from "../../fx/domain/FxRate.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface FxRateStoreShape {
  readonly findExact: (input: {
    readonly asOfDate: Date;
    readonly currency: string;
  }) => Effect.Effect<FxRateLookup | undefined, PurchasePortError>;
  readonly findMostRecent: (input: {
    readonly currency: string;
    readonly from: Date;
    readonly to: Date;
  }) => Effect.Effect<FxRateLookup | undefined, PurchasePortError>;
  readonly hasAny: () => Effect.Effect<boolean, PurchasePortError>;
  /** Writes are held to the tighter {@link FxRateWrite} contract; reads are not. */
  readonly persist: (rates: ReadonlyArray<FxRateWrite>) => Effect.Effect<void, PurchasePortError>;
}

/** Durable FX cache used by purchase money normalization. */
export class FxRateStore extends Context.Service<FxRateStore, FxRateStoreShape>()(
  "@voidhash/core-v2/purchases/FxRateStore",
) {}

export interface FxRateSourceShape {
  readonly fetchLatestUsdRates: () => Effect.Effect<ReadonlyArray<FxRateLookup>, PurchasePortError>;
}

/** Bulk upstream exchange-rate source. */
export class FxRateSource extends Context.Service<FxRateSource, FxRateSourceShape>()(
  "@voidhash/core-v2/purchases/FxRateSource",
) {}
