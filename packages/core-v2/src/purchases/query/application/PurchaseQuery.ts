import type { AuthSession } from "@voidhash/rpc";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  PurchaseAuthorizer,
  PurchaseQueryStore,
  type PurchaseActionForbiddenError,
} from "../../application/ports/PurchaseQueryStore.ts";
import { PurchasePortError } from "../../application/ports/PurchasePortError.ts";
import { type Purchase } from "../../domain/Purchase.ts";
import { RequestEnvironmentMode } from "../../runtime/RequestEnvironmentMode.ts";

export class PurchaseServiceError extends Schema.TaggedErrorClass<PurchaseServiceError>(
  "PurchaseServiceError",
)("PurchaseServiceError", { cause: Schema.String }) {}

export class PurchasePersonNotFoundError extends Schema.TaggedErrorClass<PurchasePersonNotFoundError>(
  "PersonNotFoundError",
)("PersonNotFoundError", { id: Schema.String }) {}

export type PurchaseQueryError =
  | PurchaseActionForbiddenError
  | PurchasePersonNotFoundError
  | PurchaseServiceError;

export interface PurchaseQueryShape {
  readonly getPersonPurchases: (
    personId: string,
  ) => Effect.Effect<ReadonlyArray<Purchase>, PurchaseQueryError, AuthSession>;
}

const PersonPurchaseQuery = Schema.Struct({ personId: Schema.NonEmptyString });

const makePurchaseQuery = Effect.fn("makePurchaseQuery")(function* () {
  const authorizer = yield* PurchaseAuthorizer;
  const store = yield* PurchaseQueryStore;

  return {
    getPersonPurchases: (personId) =>
      Effect.gen(function* () {
        const input = yield* Schema.decodeUnknownEffect(PersonPurchaseQuery)({ personId }).pipe(
          Effect.mapError((error) => new PurchaseServiceError({ cause: String(error) })),
        );
        yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);
        const person = yield* store.findPerson(input.personId);
        if (!person) {
          return yield* new PurchasePersonNotFoundError({ id: input.personId });
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
        yield* authorizer.requireProject(
          person.projectId,
          `Caller is not authorized to access person ${input.personId} for project ${person.projectId}`,
        );
        const environment = yield* RequestEnvironmentMode;
        const purchases = yield* store.listPersonPurchases({
          personId: input.personId,
          providerEnvironments: environment.providerEnvironments,
        });
        yield* Effect.annotateCurrentSpan("voidhash.purchase.count", purchases.length);
        return purchases;
      }).pipe(
        Effect.mapError((error) => {
          if (error instanceof PurchasePortError) {
            return new PurchaseServiceError({ cause: error.message });
          }
          return error;
        }),
      ),
  } satisfies PurchaseQueryShape;
})();

export class PurchaseQuery extends Context.Service<PurchaseQuery, PurchaseQueryShape>()(
  "@voidhash/core-v2/purchases/PurchaseQuery",
  { make: makePurchaseQuery },
) {
  static readonly layer = Layer.effect(PurchaseQuery)(PurchaseQuery.make);
}

export { PurchaseQuery as PurchaseService };
export { PurchasePersonNotFoundError as PersonNotFoundError };
export type { PurchasePortError };
