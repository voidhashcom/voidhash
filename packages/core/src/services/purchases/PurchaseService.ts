import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { PersonNotFoundError } from "../../domain/person/Person.ts";
import { Db } from "@voidhash/db";
import { checkProjectPermission } from "../../utils/permissions.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
export class PurchaseServiceError extends Schema.TaggedErrorClass<PurchaseServiceError>(
  "PurchaseServiceError",
)("PurchaseServiceError", { cause: Schema.String }) {}

/**
 * `PurchaseService` is the entry point for the purchases aggregate.
 *
 * Currently exposes `getPersonPurchases` — lookups for a single person's
 * purchase history behind a `project:all` permission check. Lives in its own
 * service (rather than alongside `PersonService`) because purchases are not
 * part of the persons aggregate.
 *
 * `AuthSession` and `Db` are provided by the application root.
 */
export class PurchaseService extends Context.Service<PurchaseService>()("PurchaseService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const getPersonPurchases = Effect.fn("getPersonPurchases")(
      function* (personId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
        const session = yield* AuthSession;
        if (session?.method) {
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        }
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        if (session?.person?.distinctId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        }
        const person = yield* db.query.persons.findFirst({ where: { id: personId } });
        if (!person) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
        yield* checkProjectPermission(
          person.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${personId} for project ${person.projectId}`,
        );
        const personPurchases = yield* db.query.purchases.findMany({
          where: { personId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.purchase.count", personPurchases.length);
        if (personPurchases[0]?.providerKey) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.key",
            personPurchases[0].providerKey,
          );
        }
        return personPurchases;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PurchaseServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return { getPersonPurchases } as const;
  }),
}) {
  static layer = Layer.effect(PurchaseService)(PurchaseService.make);
}
