import { type Customer as DbCustomer, and, customers, eq } from "@voidhash/db";
import type { Db } from "@voidhash/db/effect";

export const _getCustomerByAppUserId = (db: Db) =>
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

export const _getCustomerById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.customers.findFirst({
          where: eq(customers.id, id),
        })
    )
  );

export const _updateCustomerRecord = (db: Db) =>
  db.makeQuery(
    (execute, customer: Omit<Partial<DbCustomer>, "id"> & { id: string }) =>
      execute(async (db) => {
        await db
          .update(customers)
          .set(customer)
          .where(eq(customers.id, customer.id));
        return { id: customer.id };
      })
  );
