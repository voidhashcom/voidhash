import {
  type CustomerOriginValue,
  CustomerType,
  customers,
  eq,
  type InsertCustomer
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import { CustomerServiceError } from '@voidhash/shared';
import { Effect } from 'effect';

const _createCustomerRecord = (db: Db) =>
  db.makeQuery((execute, customer: InsertCustomer) =>
    execute(async (db) => {
      await db.insert(customers).values(customer);
      return { id: customer.id };
    })
  );

export const createCustomer = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createCustomer')(
    function* (input: {
      projectId: string;
      appUserId: string;
      name: string | null;
      email: string | null;
      origin: CustomerOriginValue;
      parentCustomerId?: string;
    }) {
      const newCustomer = {
        id: generateId('customer'),
        type: input.appUserId.startsWith(ANONYMOUS_USER_ID_PREFIX)
          ? CustomerType.Anonymous
          : CustomerType.Identified,
        parentCustomerId: null,
        projectId: input.projectId,
        appUserId: input.appUserId,
        origin: input.origin,
        name: input.name,
        email: input.email,
        additionalAttributes: {}
        // TODO: Figure out how to handle attributes
      } satisfies InsertCustomer;

      yield* _createCustomerRecord(db)(newCustomer);

      yield* Effect.log(
        `Created customer ${newCustomer.id} (${newCustomer.type === CustomerType.Anonymous ? 'anonymous' : 'identified'}) for app user ${input.appUserId}`
      );

      return yield* Effect.succeed({
        ...newCustomer,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
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
