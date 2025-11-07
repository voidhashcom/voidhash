import { customers, customerUnlockedPerks, eq } from '@voidhash/db';
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

const _getCustomersUnlockedPerks = (db: Db) =>
  db.makeQuery((execute, customerId: string) =>
    execute(
      async (db) =>
        await db.query.customerUnlockedPerks.findMany({
          where: eq(customerUnlockedPerks.customerId, customerId)
        })
    )
  );

export const getCustomersUnlockedPerks = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getCustomersUnlockedPerks')(
    function* (customerId: string) {
      const session = yield* AuthSession;
      const [customer, perks] = yield* Effect.all(
        [
          _getCustomerById(db)(customerId),
          _getCustomersUnlockedPerks(db)(customerId)
        ],
        {
          concurrency: 'unbounded'
        }
      );
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
      return perks;
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
