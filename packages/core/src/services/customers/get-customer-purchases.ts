import { customers, eq, purchases } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  CustomerNotFoundError,
  CustomerServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getCustomerById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.customers.findFirst({
          where: eq(customers.id, id)
        })
    )
  );

const _getCustomerPurchases = (db: Db) =>
  db.makeQuery((execute, customerId: string) =>
    execute(
      async (db) =>
        await db.query.purchases.findMany({
          where: eq(purchases.customerId, customerId)
        })
    )
  );

export const getCustomerPurchases = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getCustomerPurchases')(
    function* (customerId: string) {
      const session = yield* AuthSession;
      const customer = yield* _getCustomerById(db)(customerId);
      if (!customer) {
        return yield* Effect.fail(
          new CustomerNotFoundError({
            id: customerId
          })
        );
      }
      yield* checkProjectPermission(
        customer.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access customer ${customerId} for project ${customer.projectId}`
      );
      return yield* _getCustomerPurchases(db)(customerId);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new CustomerServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
