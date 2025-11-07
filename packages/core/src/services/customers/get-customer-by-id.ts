import { customers, eq } from '@voidhash/db';
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

export const getCustomerById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getCustomerById')(
    function* (id: string) {
      const session = yield* AuthSession;
      const customer = yield* _getCustomerById(db)(id);
      if (!customer) {
        return yield* Effect.fail(
          new CustomerNotFoundError({
            id
          })
        );
      }
      yield* checkProjectPermission(
        customer.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access customer ${id} for project ${customer.projectId}`
      );
      return customer;
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
