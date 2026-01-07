import { and, customers, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  CustomerNotFoundError,
  CustomerServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getCustomerByAppUserId = (db: Db) =>
  db.makeQuery(
    (
      execute,
      {
        projectId,
        appUserId,
      }: {
        projectId: string;
        appUserId: string;
      }
    ) =>
      execute(
        async (db) =>
          await db.query.customers.findFirst({
            where: and(
              eq(customers.projectId, projectId),
              eq(customers.appUserId, appUserId)
            ),
          })
      )
  );

export const getCustomerByAppUserId = Effect.gen(
  function* getCustomerByAppUserId() {
    const db = yield* Db;
    return Effect.fn("getCustomerByAppUserId")(
      function* getCustomerByAppUserId(appUserId: string, projectId: string) {
        const session = yield* AuthSession;
        const customer = yield* _getCustomerByAppUserId(db)({
          appUserId,
          projectId,
        });
        if (!customer) {
          return yield* Effect.fail(
            new CustomerNotFoundError({
              id: appUserId,
            })
          );
        }
        yield* checkProjectPermission(
          customer.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access customer ${appUserId} for project ${customer.projectId}`
        );
        return {
          appUserId: customer.appUserId,
          createdAt: customer.createdAt,
          email: customer.email,
          id: customer.id,
          name: customer.name,
          type: customer.type,
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause),
              }),
          })
        )
    );
  }
);
