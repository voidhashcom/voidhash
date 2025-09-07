import {
  and,
  type Customer,
  type CustomerTypeValue,
  customers,
  customerUnlockedPerks,
  eq,
  externalCustomerIdentifiers,
  type InsertCustomer,
  type InsertCustomerUnlockedPerk,
  purchases
} from '@voidhash/db';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { Effect } from 'effect';
import { Db } from '@/lib/effect/db';

export class CustomerRepository extends Effect.Service<CustomerRepository>()(
  'CustomerRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createCustomer: dbService.makeQuery(
          (execute, customer: InsertCustomer) =>
            execute(async (db) => {
              await db.insert(customers).values(customer);
              return { id: customer.id };
            })
        ),

        getCustomers: dbService.makeQuery(
          (
            execute,
            {
              projectId,
              environment,
              type
            }: {
              projectId: string;
              environment: EnvironmentValue;
              type: CustomerTypeValue | null;
            }
          ) =>
            execute(
              async (db) =>
                await db.query.customers.findMany({
                  where: and(
                    eq(customers.projectId, projectId),
                    type !== null ? eq(customers.type, type) : undefined,
                    eq(customers.environment, environment)
                  )
                })
            )
        ),

        getCustomerById: dbService.makeQuery((execute, id: string) =>
          execute(
            async (db) =>
              await db.query.customers.findFirst({
                where: eq(customers.id, id)
              })
          )
        ),

        getCustomerByAppUserId: dbService.makeQuery(
          (
            execute,
            {
              projectId,
              appUserId,
              environment
            }: {
              projectId: string;
              appUserId: string;
              environment: EnvironmentValue;
            }
          ) =>
            execute(
              async (db) =>
                await db.query.customers.findFirst({
                  where: and(
                    eq(customers.projectId, projectId),
                    eq(customers.appUserId, appUserId),
                    eq(customers.environment, environment)
                  )
                })
            )
        ),

        getCustomerByExternalIdentifier: dbService.makeQuery(
          (
            execute,
            {
              projectId,
              serviceId,
              identifier,
              environment
            }: {
              projectId: string;
              serviceId: string;
              identifier: string;
              environment: EnvironmentValue;
            }
          ) =>
            execute(
              async (db) =>
                await db
                  .select()
                  .from(customers)
                  .innerJoin(
                    externalCustomerIdentifiers,
                    eq(customers.id, externalCustomerIdentifiers.customerId)
                  )
                  .where(
                    and(
                      eq(customers.projectId, projectId),
                      eq(externalCustomerIdentifiers.serviceId, serviceId),
                      eq(externalCustomerIdentifiers.identifier, identifier),
                      eq(customers.environment, environment)
                    )
                  )
            )
        ),

        createCustomerUnlockedPerks: dbService.makeQuery(
          (execute, input: InsertCustomerUnlockedPerk[]) =>
            execute(async (db) => {
              await db.insert(customerUnlockedPerks).values(input);
              return { ids: input.map((perk) => perk.id) };
            })
        ),

        getCustomersUnlockedPerks: dbService.makeQuery(
          (execute, customerId: string) =>
            execute(
              async (db) =>
                await db.query.customerUnlockedPerks.findMany({
                  where: eq(customerUnlockedPerks.customerId, customerId)
                })
            )
        ),

        getCustomerPurchases: dbService.makeQuery(
          (execute, customerId: string) =>
            execute(
              async (db) =>
                await db.query.purchases.findMany({
                  where: eq(purchases.customerId, customerId)
                })
            )
        ),

        updateCustomer: dbService.makeQuery(
          (execute, customer: Omit<Partial<Customer>, 'id'> & { id: string }) =>
            execute(async (db) => {
              await db
                .update(customers)
                .set(customer)
                .where(eq(customers.id, customer.id));
              return { id: customer.id };
            })
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
