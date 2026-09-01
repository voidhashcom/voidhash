import type { AuthSession } from "@voidhash/rpc";
import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";

import type { Purchase } from "../../domain/Purchase.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface PurchasePersonRecord {
  readonly id: string;
  readonly projectId: string;
}

export interface PurchaseQueryStoreShape {
  readonly findPerson: (
    personId: string,
  ) => Effect.Effect<PurchasePersonRecord | typeof Schema.Undefined.Type, PurchasePortError>;
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

export class PurchaseActionForbiddenError extends Schema.TaggedErrorClass<PurchaseActionForbiddenError>(
  "PurchaseActionForbiddenError",
)("PurchaseActionForbiddenError", { message: Schema.String }) {}

/** Authorization boundary used by purchase queries. */
export class PurchaseAuthorizer extends Context.Service<
  PurchaseAuthorizer,
  PurchaseAuthorizerShape
>()("@voidhash/core-v2/purchases/PurchaseAuthorizer") {}
