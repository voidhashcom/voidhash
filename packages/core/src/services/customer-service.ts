import {
  type CustomerOriginValue,
  CustomerType,
  type CustomerTypeValue,
  type InsertCustomer
} from '@voidhash/db';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { Effect } from 'effect';
import { CustomerRepository } from '../repositories/customer-repository';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';
import { Environment } from './environment-service';
import { CustomerNotFoundError, InvalidAnonymousIdError } from './errors';

export class CustomerService extends Effect.Service<CustomerService>()(
  'CustomerService',
  {
    dependencies: [CustomerRepository.Default],
    effect: Effect.gen(function* () {
      const customerRepository = yield* CustomerRepository;
      return {
        createCustomer: (input: {
          projectId: string;
          appUserId: string;
          origin: CustomerOriginValue;
          environment: EnvironmentValue;
        }) =>
          Effect.gen(function* () {
            const customerRepository = yield* CustomerRepository;

            if (!input.appUserId.startsWith(ANONYMOUS_USER_ID_PREFIX)) {
              return yield* Effect.fail(
                new InvalidAnonymousIdError({
                  message: `Invalid anonymous id: ${input.appUserId}`
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
              environment: input.environment,
              name: null,
              email: null,
              additionalAttributes: {}
              // TODO: Figure out how to handle attributes
            } satisfies InsertCustomer;

            yield* customerRepository.createCustomer(newCustomer);

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

        getCustomers: ({
          projectId,
          type
        }: {
          projectId: string;
          type?: CustomerTypeValue;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access customers for project ${projectId}`
            );
            return yield* customerRepository.getCustomers({
              projectId,
              environment,
              type: type ?? null
            });
          }),
        getCustomerById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const customer = yield* customerRepository.getCustomerById(id);
            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  message: 'Customer not found'
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

        getCustomerByAppUserId: (appUserId: string) =>
          Effect.gen(function* () {
            const environment = yield* Environment;
            const session = yield* AuthSession;
            const projectId = session?.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.dieMessage(
                'Project ID not found after authentication'
              );
            }
            const customer = yield* customerRepository.getCustomerByAppUserId({
              projectId,
              appUserId,
              environment
            });
            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  message: 'Customer not found'
                })
              );
            }
            yield* checkProjectPermission(
              customer.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access customer ${appUserId} for project ${customer.projectId}`
            );
            return customer;
          }),

        getCustomersUnlockedPerks: (customerId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const [customer, perks] = yield* Effect.all(
              [
                customerRepository.getCustomerById(customerId),
                customerRepository.getCustomersUnlockedPerks(customerId)
              ],
              {
                concurrency: 'unbounded'
              }
            );
            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  message: 'Customer not found'
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

        getCustomerPurchases: (customerId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const customer =
              yield* customerRepository.getCustomerById(customerId);
            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  message: 'Customer not found'
                })
              );
            }
            yield* checkProjectPermission(
              customer.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access customer ${customerId} for project ${customer.projectId}`
            );
            return yield* customerRepository.getCustomerPurchases(customerId);
          }),

        mergeCustomers: (fromCustomerId: string, toCustomerId: string) =>
          Effect.gen(function* () {
            const customerRepository = yield* CustomerRepository;

            return yield* customerRepository.updateCustomer({
              id: fromCustomerId,
              parentCustomerId: toCustomerId,
              archivedAt: new Date()
            });

            // TODO: Update all the customer's subscriptions to the new customer
            // TODO: Update all the customer's purchases to the new customer
            // TODO: Update all the customer's unlocked perks to the new customer
            // TODO: Update all the customer's external identifiers to the new customer
            // TODO: Update all the customer's transactions to the new customer
          })
      };
    })
  }
) {}
