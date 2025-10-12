import type { Customer } from '@voidhash/api-spec';
import {
  and,
  type CustomerOriginValue,
  CustomerType,
  type CustomerTypeValue,
  customers,
  customerUnlockedPerks,
  eq,
  type InsertCustomer,
  purchases,
  type UpdateCustomer
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import {
  AuthSession,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError
} from '@voidhash/shared';
import { Effect, pipe, type Schema } from 'effect';
import { checkProjectPermission } from '../utils/permissions';

export class CustomerService extends Effect.Service<CustomerService>()(
  'CustomerService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _createCustomerRecord = dbService.makeQuery(
        (execute, customer: InsertCustomer) =>
          execute(async (db) => {
            await db.insert(customers).values(customer);
            return { id: customer.id };
          })
      );

      const createCustomer = (input: {
        projectId: string;
        appUserId: string;
        name: string | null;
        email: string | null;
        origin: CustomerOriginValue;
        parentCustomerId?: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            if (!input.appUserId.startsWith(ANONYMOUS_USER_ID_PREFIX)) {
              return yield* Effect.fail(
                new CustomerInvalidAnonymousIdError({
                  id: input.appUserId
                })
              );
            }

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

            yield* _createCustomerRecord(newCustomer);

            yield* Effect.log(
              `Created customer ${newCustomer.id} (${newCustomer.type === CustomerType.Anonymous ? 'anonymous' : 'identified'}) for app user ${input.appUserId}`
            );

            return yield* Effect.succeed({
              ...newCustomer,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getCustomers = dbService.makeQuery(
        (
          execute,
          {
            projectId,

            type
          }: {
            projectId: string;

            type: CustomerTypeValue | null;
          }
        ) =>
          execute(
            async (db) =>
              await db.query.customers.findMany({
                where: and(
                  eq(customers.projectId, projectId),
                  type !== null ? eq(customers.type, type) : undefined
                )
              })
          )
      );

      const getCustomers = ({
        projectId,
        type
      }: {
        projectId: string;
        type?: CustomerTypeValue;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access customers for project ${projectId}`
            );
            return yield* _getCustomers({
              projectId,
              type: type ?? null
            });
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getCustomerById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.customers.findFirst({
              where: eq(customers.id, id)
            })
        )
      );

      const getCustomerById = (id: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const customer = yield* _getCustomerById(id);
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
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getCustomerByAppUserId = dbService.makeQuery(
        (
          execute,
          {
            projectId,
            appUserId
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
                )
              })
          )
      );

      const getCustomerByAppUserId = (appUserId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const projectId = session?.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.dieMessage(
                'Project ID not found after authentication'
              );
            }
            const customer = yield* _getCustomerByAppUserId({
              projectId,
              appUserId
            });
            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  id: appUserId
                })
              );
            }
            yield* checkProjectPermission(
              customer.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access customer ${appUserId} for project ${customer.projectId}`
            );
            return {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              appUserId: customer.appUserId
            } satisfies Schema.Schema.Type<typeof Customer>;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getCustomersUnlockedPerks = dbService.makeQuery(
        (execute, customerId: string) =>
          execute(
            async (db) =>
              await db.query.customerUnlockedPerks.findMany({
                where: eq(customerUnlockedPerks.customerId, customerId)
              })
          )
      );

      const getCustomersUnlockedPerks = (customerId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const [customer, perks] = yield* Effect.all(
              [
                _getCustomerById(customerId),
                _getCustomersUnlockedPerks(customerId)
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
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getCustomerPurchases = dbService.makeQuery(
        (execute, customerId: string) =>
          execute(
            async (db) =>
              await db.query.purchases.findMany({
                where: eq(purchases.customerId, customerId)
              })
          )
      );

      const getCustomerPurchases = (customerId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const customer = yield* _getCustomerById(customerId);
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
            return yield* _getCustomerPurchases(customerId);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _updateCustomerRecord = dbService.makeQuery(
        (execute, customer: UpdateCustomer) =>
          execute(async (db) => {
            await db
              .update(customers)
              .set(customer)
              .where(eq(customers.id, customer.id));
            return { id: customer.id };
          })
      );

      const mergeCustomers = (fromCustomerId: string, toCustomerId: string) =>
        pipe(
          Effect.gen(function* () {
            return yield* _updateCustomerRecord({
              id: fromCustomerId,
              parentCustomerId: toCustomerId,
              archivedAt: new Date()
            });

            // TODO: Update all the customer's subscriptions to the new customer
            // TODO: Update all the customer's purchases to the new customer
            // TODO: Update all the customer's unlocked perks to the new customer
            // TODO: Update all the customer's external identifiers to the new customer
            // TODO: Update all the customer's transactions to the new customer
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new CustomerServiceError({
                cause: String(error.cause)
              })
          })
        );
      return {
        createCustomer,
        getCustomers,
        getCustomerById,
        getCustomerByAppUserId,
        getCustomersUnlockedPerks,
        getCustomerPurchases,
        mergeCustomers
      } as const;
    })
  }
) {}
