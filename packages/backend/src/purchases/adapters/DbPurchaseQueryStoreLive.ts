import {
  PurchaseActionForbiddenError,
  PurchaseAuthorizer,
  PurchasePortError,
  PurchaseQueryStore,
  PurchaseRows,
} from "@voidhash/core-v2";
import { Db } from "@voidhash/db";
import { AuthSession } from "@voidhash/rpc";
import { Effect, Layer, Schema } from "effect";

const PersonRecord = Schema.Struct({
  id: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

/** PostgreSQL purchase-query persistence with schema validation at the database boundary. */
export const DbPurchaseQueryStoreLive = Layer.effect(
  PurchaseQueryStore,
  Effect.gen(function* () {
    const db = yield* Db;

    return PurchaseQueryStore.of({
      findPerson: (personId) =>
        db.query.persons
          .findFirst({ columns: { id: true, projectId: true }, where: { id: personId } })
          .pipe(
            Effect.flatMap((row) => {
              if (row === undefined) return Effect.succeed(undefined);
              return Schema.decodeUnknownEffect(PersonRecord)(row);
            }),
            Effect.mapError(portError("failed to load purchase owner")),
          ),
      listPersonPurchases: ({ personId, providerEnvironments }) =>
        db.query.purchases
          .findMany({
            where: {
              personId,
              providerEnvironment: { in: [...providerEnvironments] },
            },
          })
          .pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(PurchaseRows)),
            Effect.mapError(portError("failed to load person purchases")),
          ),
    });
  }),
);

/** Request-scoped project authorization for purchase applications. */
export const PurchaseAuthorizerLive = Layer.succeed(PurchaseAuthorizer, {
  requireProject: (projectId, message) =>
    Effect.gen(function* () {
      const session = yield* AuthSession;
      const project = session.projects.find((candidate) => candidate.id === projectId);
      if (!project?.permissions.includes("project:all")) {
        return yield* Effect.fail(new PurchaseActionForbiddenError(message));
      }
    }),
});

export const PurchaseQueryPortsLive = Layer.merge(DbPurchaseQueryStoreLive, PurchaseAuthorizerLive);
