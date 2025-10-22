import type { SdkCustomer } from '@voidhash/api-spec';
import {
  and,
  CustomerOrigin,
  CustomerType,
  customers,
  type Customer as DbCustomer,
  eq
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import {
  AuthenticationError,
  AuthSession,
  SdkCustomerAlreadyIdentifiedError,
  SdkCustomerNotFoundError,
  SdkServiceError,
  SdkValidationError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import type { CustomerMetadata } from '../types';
import { CustomerService } from './customer-service';

type CustomerAttributesParams = {
  name?: string;
  email?: string;
  customerMetadata: CustomerMetadata;
};

export class SdkService extends Effect.Service<SdkService>()('SdkService', {
  dependencies: [CustomerService.Default],
  effect: Effect.gen(function* () {
    const dbService = yield* Db;
    const customerService = yield* CustomerService;

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

    const _getCustomerById = dbService.makeQuery((execute, id: string) =>
      execute(
        async (db) =>
          await db.query.customers.findFirst({
            where: eq(customers.id, id)
          })
      )
    );

    const identifyCustomer = (input: {
      appUserId: string;
      name: string | null;
      email: string | null;
    }): Effect.Effect<
      typeof SdkCustomer.Type,
      | AuthenticationError
      | SdkServiceError
      | SdkValidationError
      | SdkCustomerAlreadyIdentifiedError,
      AuthSession
    > =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new AuthenticationError({
                cause:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.',
                message:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.'
              })
            );
          }

          const result = yield* dbService.transaction((tx) =>
            TransactionContext.provide(tx)(
              Effect.gen(function* () {
                const currentAppUserId = session?.customer?.appUserId;

                // Get current customer if exists
                let currentCustomer: DbCustomer | undefined;
                if (currentAppUserId) {
                  currentCustomer = yield* _getCustomerByAppUserId({
                    appUserId: currentAppUserId,
                    projectId
                  });
                }

                // Can't identify already identified anonymous customer.
                if (
                  currentCustomer &&
                  currentCustomer.type === CustomerType.Anonymous &&
                  currentCustomer.parentCustomerId
                ) {
                  const parentCustomer = yield* _getCustomerById(
                    currentCustomer.parentCustomerId
                  );
                  if (!parentCustomer) {
                    return yield* Effect.die(
                      new Error(
                        'parentCustomer is null event though it should exist'
                      )
                    );
                  }

                  if (parentCustomer.appUserId !== input.appUserId) {
                    return yield* Effect.fail(
                      new SdkCustomerAlreadyIdentifiedError({
                        appUserId: input.appUserId
                      })
                    );
                  }

                  return parentCustomer;
                }

                // Get identifying as customer if exists
                let identifyingAsCustomer = yield* _getCustomerByAppUserId({
                  appUserId: input.appUserId,
                  projectId
                });

                // If identifying as customer doesn't exist, create a new one
                if (!identifyingAsCustomer) {
                  yield* customerService.createCustomer({
                    projectId,
                    appUserId: input.appUserId,
                    name: input.name ?? null,
                    email: input.email ?? null,
                    origin: CustomerOrigin.IOS // TODO: Make this dynamic
                  });

                  identifyingAsCustomer = yield* _getCustomerByAppUserId({
                    appUserId: input.appUserId,
                    projectId
                  });

                  if (!identifyingAsCustomer) {
                    return yield* Effect.dieMessage(
                      'identifyingAsCustomer is null event though it should exist'
                    );
                  }
                }

                // Merge customers if current customer is anonymous
                if (
                  currentCustomer &&
                  currentCustomer.type === CustomerType.Anonymous
                ) {
                  yield* customerService.mergeCustomers(
                    currentCustomer.id,
                    identifyingAsCustomer.id
                  );
                }

                // Get updated identified customer
                const updatedCustomer = yield* _getCustomerByAppUserId({
                  appUserId: input.appUserId,
                  projectId
                });

                if (!updatedCustomer) {
                  return yield* Effect.dieMessage(
                    'updatedCustomer is null event though it should exist'
                  );
                }

                return updatedCustomer;
              })
            )
          );

          yield* Effect.log(
            `Identified customer ${result.id} for app user ${input.appUserId}`
          );

          return {
            appUserId: result.appUserId,
            name: result.name,
            email: result.email,
            customerId: result.id
          };
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            }),
          CustomerServiceError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            }),
          CustomerInvalidAnonymousIdError: () =>
            new SdkValidationError({
              message: 'Invalid anonymous ID'
            })
        })
      );

    const _updateCustomerRecord = dbService.makeQuery(
      (execute, customer: Omit<Partial<DbCustomer>, 'id'> & { id: string }) =>
        execute(async (db) => {
          await db
            .update(customers)
            .set(customer)
            .where(eq(customers.id, customer.id));
          return { id: customer.id };
        })
    );

    const syncCustomerAttributes = (
      input: CustomerAttributesParams
    ): Effect.Effect<
      typeof SdkCustomer.Type,
      AuthenticationError | SdkServiceError | SdkValidationError,
      AuthSession
    > =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;

          const appUserId = session?.customer?.appUserId;
          if (!appUserId) {
            return yield* Effect.fail(
              new SdkValidationError({
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new AuthenticationError({
                cause:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.',
                message:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.'
              })
            );
          }

          // Get or create customer
          const customer = yield* pipe(
            _getCustomerByAppUserId({
              appUserId,
              projectId
            }),

            Effect.andThen((customer) => {
              if (customer) {
                return Effect.succeed(customer);
              }

              return pipe(
                customerService.createCustomer({
                  projectId,
                  appUserId,
                  name: null,
                  email: null,
                  origin: CustomerOrigin.IOS // TODO: Make this dynamic
                }),

                // Get customer after creation
                Effect.andThen(() =>
                  _getCustomerByAppUserId({
                    appUserId,
                    projectId
                  })
                ),

                // This is required to make the type checker happy
                Effect.andThen((customer) =>
                  customer
                    ? Effect.succeed(customer)
                    : Effect.dieMessage(
                        'Customer not found after syncCustomerData. This should never happen, because we created it before retrieving it.'
                      )
                )
              );
            })
          );

          yield* _updateCustomerRecord({
            id: customer.id,
            name: input.name,
            email: input.email,
            additionalAttributes: {
              ...(customer.additionalAttributes ?? {}),
              platform: input.customerMetadata.platform,
              sdk: input.customerMetadata.sdk,
              sdkVersion: input.customerMetadata.sdkVersion,
              platformFlavor: input.customerMetadata.platformFlavor,
              platformFlavorVersion:
                input.customerMetadata.platformFlavorVersion,
              platformVersion: input.customerMetadata.platformVersion,
              platformDevice: input.customerMetadata.platformDevice,
              platformBrand: input.customerMetadata.platformBrand,
              preferredLocales: input.customerMetadata.preferredLocales,
              clientLocale: input.customerMetadata.clientLocale,
              clientVersion: input.customerMetadata.clientVersion,
              storefront: input.customerMetadata.storefront
            }
          });

          return {
            appUserId: customer.appUserId,
            name: customer.name,
            email: customer.email,
            customerId: customer.id
          } satisfies typeof SdkCustomer.Type;
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            }),
          CustomerServiceError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            }),
          CustomerInvalidAnonymousIdError: () =>
            new SdkValidationError({
              message: 'Invalid anonymous ID'
            })
        })
      );

    const getCustomer = (): Effect.Effect<
      typeof SdkCustomer.Type,
      | AuthenticationError
      | SdkServiceError
      | SdkCustomerNotFoundError
      | SdkValidationError,
      AuthSession
    > =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;

          const appUserId = session?.customer?.appUserId;
          if (!appUserId) {
            return yield* Effect.fail(
              new SdkValidationError({
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new AuthenticationError({
                cause:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.',
                message:
                  'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.'
              })
            );
          }

          const result = yield* dbService.transaction((tx) =>
            TransactionContext.provide(tx)(
              Effect.gen(function* () {
                // Try to get existing customer
                const customer = yield* _getCustomerByAppUserId({
                  appUserId,
                  projectId
                });

                if (customer) {
                  // Return parent if it exists, otherwise return the customer itself
                  if (customer.parentCustomerId) {
                    const parentCustomer = yield* _getCustomerById(
                      customer.parentCustomerId
                    );
                    return parentCustomer;
                  }
                  return customer;
                }

                // Customer not found and not anonymous ID
                return yield* Effect.fail(
                  new SdkCustomerNotFoundError({
                    message: 'Customer not found'
                  })
                );
              })
            )
          );

          if (!result) {
            return yield* Effect.fail(
              new SdkCustomerNotFoundError({
                message: 'Customer not found'
              })
            );
          }

          return {
            appUserId: result.appUserId,
            name: result.name,
            email: result.email,
            customerId: result.id
          };
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            })
        })
      );

    return {
      identifyCustomer,
      syncCustomerAttributes,
      getCustomer
    } as const;
  })
}) {}
