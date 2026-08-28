import type { AuthSession } from "@voidhash/rpc";
import { Context, type Effect } from "effect";

import type { Purchase } from "../../domain/Purchase.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface PurchasePersonRecord {
  readonly id: string;
  readonly projectId: string;
}

export interface PurchaseQueryStoreShape {
  readonly findPerson: (
    personId: string,
  ) => Effect.Effect<PurchasePersonRecord | undefined, PurchasePortError>;
  readonly listPersonPurchases: (input: {
    readonly personId: string;
    readonly providerEnvironments: ReadonlyArray<1 | 2 | 3>;
  }) => Effect.Effect<ReadonlyArray<Purchase>, PurchasePortError>;
}

/** Persistence boundary used by purchase queries. */
export class PurchaseQueryStore extends Context.Service<
  PurchaseQueryStore,
  PurchaseQueryStoreShape
>()("@voidhash/core-v2/purchases/PurchaseQueryStore") {}

export interface PurchaseAuthorizerShape {
  readonly requireProject: (
    projectId: string,
    message: string,
  ) => Effect.Effect<void, PurchaseActionForbiddenError, AuthSession>;
}

export class PurchaseActionForbiddenError extends Error {
  readonly _tag = "ActionForbiddenError";
  override readonly message: string;

  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

/** Authorization boundary used by purchase queries. */
export class PurchaseAuthorizer extends Context.Service<
  PurchaseAuthorizer,
  PurchaseAuthorizerShape
>()("@voidhash/core-v2/purchases/PurchaseAuthorizer") {}
