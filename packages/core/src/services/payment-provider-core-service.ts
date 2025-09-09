import type {
  InsertSubscription,
  ProviderEnvironmentValue
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { SubscriptionStatus } from '@voidhash/lib/constants';
import { Effect, pipe } from 'effect';
import { CustomerRepository } from '../repositories/customer-repository';
import { PaymentProviderConfigurationProductRepository } from '../repositories/payment-provider-configuration-product-repository';
import { SubscriptionRepository } from '../repositories/subscription-repository';
import {
  CustomerNotFoundError,
  PaymentProviderConfigurationProductNotFoundError,
  SubscriptionNotFoundError,
  SubscriptionWithSameInitialTransactionIdAlreadyExistsError,
  SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError
} from './errors';
import { PerkGrantService } from './perk-grant-service';

export class PaymentProviderCoreService extends Effect.Service<PaymentProviderCoreService>()(
  'PaymentProviderCoreService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        /**
         * Create a subscription for a customer
         * @param input - The input for the subscription creation
         * @returns The created subscription
         */
        createSubscription: (input: {
          /**
           * The customer id
           */
          customerId: string;
          /**
           * The transaction id
           */
          transactionId: string;
          /**
           * The store subscription id - this is the id of the subscription in the payment provider
           */
          storeSubscriptionId: string;
          /**
           * The payment provider configuration product id
           */
          paymentProviderConfigurationProductId: string;
          /**
           * Whether the subscription is a trial
           */
          isTrial: boolean;
          /**
           * The date the subscription was purchased
           */
          purchasedAt: Date;
          /**
           * The date the subscription starts
           */
          startsAt: Date;
          /**
           * The date the subscription was canceled
           */
          canceledAt: Date | null;
          /**
           * Whether the subscription is canceled at the end of the period
           */
          cancelAtPeriodEnd: boolean;
          /**
           * The date the subscription expires
           */
          expiresAt: Date | null;
          /**
           * The provider environment
           */
          providerEnvironment: ProviderEnvironmentValue;
        }) =>
          Effect.gen(function* () {
            const customerRepository = yield* CustomerRepository;
            const subscriptionRepository = yield* SubscriptionRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;
            const perkGrantService = yield* PerkGrantService;
            const db = yield* Db;

            const [customer, paymentProviderProduct] = yield* Effect.all([
              customerRepository.getCustomerById(input.customerId),
              paymentProviderConfigurationProductRepository.getProviderProductById(
                input.paymentProviderConfigurationProductId
              )
            ]);

            if (!customer) {
              return yield* Effect.fail(
                new CustomerNotFoundError({
                  message: `Customer with id ${input.customerId} not found`
                })
              );
            }

            if (!paymentProviderProduct) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationProductNotFoundError({
                  message: `Payment provider configuration product with id ${input.paymentProviderConfigurationProductId} not found`
                })
              );
            }

            const newSubscription = {
              id: generateId('subscription'),
              status: SubscriptionStatus.Active,
              customerId: input.customerId,
              initialTransactionId: input.transactionId,
              latestTransactionId: input.transactionId,
              storeSubscriptionId: input.storeSubscriptionId,
              paymentProviderConfigurationProductId:
                input.paymentProviderConfigurationProductId,
              purchasedAt: input.purchasedAt,
              startsAt: input.startsAt,
              canceledAt: input.canceledAt,
              cancelAtPeriodEnd: input.cancelAtPeriodEnd,
              providerEnvironment: input.providerEnvironment,
              expiresAt: input.expiresAt
            } satisfies InsertSubscription;

            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                pipe(
                  assertSubscriptionDoesNotExist(
                    customer.projectId,
                    input.transactionId,
                    input.storeSubscriptionId
                  ),
                  Effect.andThen(
                    subscriptionRepository.createSubscription(newSubscription)
                  )
                )
              )
            );

            yield* perkGrantService.syncUnlockedPerks(input.customerId);
          }),

        /**
         * Renew a subscription - this is used when a subscription is renewed by the customer
         * @param input - The input for the subscription renewal
         * @returns The renewed subscription
         */
        renewSubscription: (input: {
          /**
           * The transaction id
           */
          transactionId: string;
          /**
           * The subscription id
           */
          subscriptionId: string;
          /**
           * The date the subscription was purchased
           */
          renewedAt: Date;
          /**
           * The date the subscription starts
           */
          startsAt: Date;
          /**
           * The date the subscription expires
           */
          expiresAt: Date | null;
        }) =>
          Effect.gen(function* () {
            const subscriptionRepository = yield* SubscriptionRepository;
            const perkGrantService = yield* PerkGrantService;

            const subscription =
              yield* subscriptionRepository.getSubscriptionById(
                input.subscriptionId
              );

            if (!subscription) {
              return yield* Effect.fail(
                new SubscriptionNotFoundError({
                  message: `Subscription with id ${input.subscriptionId} not found`
                })
              );
            }

            yield* subscriptionRepository.updateSubscription({
              id: input.subscriptionId,
              status: SubscriptionStatus.Active,
              latestTransactionId: input.transactionId,
              startsAt: input.startsAt,
              expiresAt: input.expiresAt,
              updatedAt: new Date()
            });

            yield* perkGrantService.syncUnlockedPerks(subscription.customerId);
          }),

        /**
         * Mark a subscription as canceled. This does not revoke any perks yet,
         * @param input - The input for the subscription cancellation
         * @returns The canceled subscription
         */
        markSubscriptionAsCanceled: (input: {
          subscriptionId: string;
          canceledAt: Date;
          cancelAtPeriodEnd: boolean;
          cancellationReason: string | null;
        }) =>
          Effect.gen(function* () {
            const subscriptionRepository = yield* SubscriptionRepository;

            const subscription =
              yield* subscriptionRepository.getSubscriptionById(
                input.subscriptionId
              );

            if (!subscription) {
              return yield* Effect.fail(
                new SubscriptionNotFoundError({
                  message: `Subscription with id ${input.subscriptionId} not found`
                })
              );
            }

            yield* subscriptionRepository.updateSubscription({
              id: input.subscriptionId,
              status: SubscriptionStatus.Canceled,
              canceledAt: input.canceledAt,
              cancelAtPeriodEnd: input.cancelAtPeriodEnd,
              cancellationReason: input.cancellationReason,
              updatedAt: new Date()
            });
          }),

        /**
         * Mark a subscription as not canceled
         * @param input - The input for the subscription un-cancellation
         * @returns The un-canceled subscription
         */
        markSubscriptionAsNotCanceled: (input: { subscriptionId: string }) =>
          Effect.gen(function* () {
            const subscriptionRepository = yield* SubscriptionRepository;

            const subscription =
              yield* subscriptionRepository.getSubscriptionById(
                input.subscriptionId
              );

            if (!subscription) {
              return yield* Effect.fail(
                new SubscriptionNotFoundError({
                  message: `Subscription with id ${input.subscriptionId} not found`
                })
              );
            }

            yield* subscriptionRepository.updateSubscription({
              id: input.subscriptionId,
              status: SubscriptionStatus.Active,
              canceledAt: null,
              cancelAtPeriodEnd: false,
              cancellationReason: null
            });
          }),

        /**
         * Revoke a subscription - this marks the subscription as canceled and expires it. This also revokes all perks linked to the subscription.
         * @param input - The input for the subscription revocation
         * @returns The revoked subscription
         */
        revokeSubscription: (input: {
          subscriptionId: string;
          revokedAt: Date;
          revocationReason: string | null;
        }) =>
          Effect.gen(function* () {
            const subscriptionRepository = yield* SubscriptionRepository;
            const perkGrantService = yield* PerkGrantService;

            const subscription =
              yield* subscriptionRepository.getSubscriptionById(
                input.subscriptionId
              );

            if (!subscription) {
              return yield* Effect.fail(
                new SubscriptionNotFoundError({
                  message: `Subscription with id ${input.subscriptionId} not found`
                })
              );
            }

            yield* subscriptionRepository.updateSubscription({
              id: input.subscriptionId,
              status: SubscriptionStatus.Canceled,
              expiresAt: input.revokedAt,
              cancellationReason: input.revocationReason,
              updatedAt: new Date()
            });

            yield* perkGrantService.syncUnlockedPerks(subscription.customerId);
          })
      };
    })
  }
) {}

/**
 * Assert that a subscription does not exist with the same store subscription id or initial transaction id
 * @param projectId - The project id
 * @param transactionId - The transaction id
 * @param storeSubscriptionId - The store subscription id
 * @returns The assertion result
 */
const assertSubscriptionDoesNotExist = (
  projectId: string,
  transactionId: string,
  storeSubscriptionId: string
) =>
  Effect.gen(function* () {
    const subscriptionRepository = yield* SubscriptionRepository;
    const [
      subscriptionWithSameStoreSubscriptionId,
      subscriptionWithSameTransactionId
    ] = yield* Effect.all(
      [
        subscriptionRepository.getSubscriptionByStoreSubscriptionId({
          storeSubscriptionId,
          projectId
        }),
        subscriptionRepository.getSubscriptionByInitialTransactionId({
          initialTransactionId: transactionId,
          projectId
        })
      ],
      {
        concurrency: 'unbounded'
      }
    );

    if (subscriptionWithSameTransactionId) {
      return yield* Effect.fail(
        new SubscriptionWithSameInitialTransactionIdAlreadyExistsError({
          message: `Subscription with initial transaction id ${transactionId} already exists`
        })
      );
    }

    if (subscriptionWithSameStoreSubscriptionId) {
      return yield* Effect.fail(
        new SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError({
          message: `Subscription with store subscription id ${storeSubscriptionId} already exists`
        })
      );
    }
  });
