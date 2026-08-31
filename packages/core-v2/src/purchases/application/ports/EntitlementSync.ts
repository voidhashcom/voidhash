import { Context, type Effect } from "effect";

import type { PurchasePortError } from "./PurchasePortError.ts";

export interface EntitlementSyncShape {
  readonly syncUnlockedPerks: (
    personId: string,
  ) => Effect.Effect<ReadonlyArray<string>, PurchasePortError>;
}

/** Transaction-bound entitlement projection synchronization. */
export class EntitlementSync extends Context.Service<EntitlementSync, EntitlementSyncShape>()(
  "@voidhash/core-v2/purchases/EntitlementSync",
) {}
