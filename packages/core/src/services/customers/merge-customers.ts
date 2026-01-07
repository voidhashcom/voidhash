import { type UpdateCustomer, customers, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { CustomerServiceError } from "@voidhash/shared";
import { Effect } from "effect";

const _updateCustomerRecord = (db: Db) =>
  db.makeQuery((execute, customer: UpdateCustomer) =>
    execute(async (db) => {
      await db
        .update(customers)
        .set(customer)
        .where(eq(customers.id, customer.id));
      return { id: customer.id };
    })
  );

export const mergeCustomers = Effect.gen(function* mergeCustomers() {
  const db = yield* Db;
  return Effect.fn("mergeCustomers")(
    function* mergeCustomers(fromCustomerId: string, toCustomerId: string) {
      return yield* _updateCustomerRecord(db)({
        archivedAt: new Date(),
        id: fromCustomerId,
        parentCustomerId: toCustomerId,
      });

      // TODO: Update all the customer's subscriptions to the new customer
      // TODO: Update all the customer's purchases to the new customer
      // TODO: Update all the customer's unlocked perks to the new customer
      // TODO: Update all the customer's external identifiers to the new customer
      // TODO: Update all the customer's transactions to the new customer
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
});
