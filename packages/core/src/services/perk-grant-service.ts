import {
  type CustomerUnlockedPerk,
  CustomerUnlockedPerkStatus,
  type PaymentProviderConfigurationProduct,
  type ProductPerk,
  type Subscription
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { SubscriptionStatus } from '@voidhash/lib/constants';
import { Effect } from 'effect';
import { CustomerRepository } from '../repositories/customer-repository';
import { CustomerUnlockedPerkRepository } from '../repositories/customer-unlocked-perk-repository';
import { ProductPerkRepository } from '../repositories/product-perk-repository';
import { SubscriptionRepository } from '../repositories/subscription-repository';

type PerkOperationCreation = {
  status: 'create';
  perkId: string;
  unlockedBySubscriptionId: string;
  expiresAt: Date | null;
};

type PerkOperationReactivation = {
  status: 'reactivate';
  perkId: string;
  unlockedBySubscriptionId: string;
  expiresAt: Date | null;
};

type PerkOperationExpiration = {
  status: 'expire';
  perkId: string;
  unlockedBySubscriptionId: string;
};

type PerkOperation =
  | PerkOperationCreation
  | PerkOperationReactivation
  | PerkOperationExpiration;

export class PerkGrantService extends Effect.Service<PerkGrantService>()(
  'PerkGrantService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        syncUnlockedPerks: (customerId: string) =>
          Effect.gen(function* () {
            const customerRepository = yield* CustomerRepository;
            const subscriptionRepository = yield* SubscriptionRepository;
            const productPerkRepository = yield* ProductPerkRepository;
            const customerUnlockedPerkRepository =
              yield* CustomerUnlockedPerkRepository;
            const db = yield* Db;
            const [unlockedPerks, customersSubscriptions] = yield* Effect.all([
              customerRepository.getCustomersUnlockedPerks(customerId),
              subscriptionRepository.getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct(
                customerId
              )
            ]);
            const unlockablePerks =
              yield* productPerkRepository.getProductPerksByPaymentProviderConfigurationProductIds(
                customersSubscriptions.map(
                  (subscription) =>
                    subscription.paymentProviderConfigurationProductId
                )
              );

            const perksFromSubscriptionsToUnlock =
              extractPerksToUnlockFromSubscriptions(
                unlockedPerks,
                unlockablePerks,
                customersSubscriptions
              );

            const perksFromSubscriptionsToDeactivate =
              extractPerksToDeactivateFromSubscriptions(
                unlockedPerks,
                unlockablePerks,
                customersSubscriptions
              );

            const operations = [
              ...perksFromSubscriptionsToUnlock,
              ...perksFromSubscriptionsToDeactivate
            ];

            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.all([
                  ...operations.map((operation) => {
                    switch (operation.status) {
                      case 'create':
                        return customerUnlockedPerkRepository.createCustomerUnlockedPerk(
                          {
                            id: generateId('customerUnlockedPerk'),
                            customerId,
                            perkId: operation.perkId,
                            unlockedBySubscriptionId:
                              operation.unlockedBySubscriptionId,
                            expiresAt: operation.expiresAt,
                            status: CustomerUnlockedPerkStatus.Active
                          }
                        );
                      case 'reactivate':
                        return customerUnlockedPerkRepository.updateCustomerUnlockedPerk(
                          {
                            id: operation.perkId,
                            expiresAt: operation.expiresAt,
                            updatedAt: new Date(),
                            status: CustomerUnlockedPerkStatus.Active
                          }
                        );
                      case 'expire':
                        return customerUnlockedPerkRepository.updateCustomerUnlockedPerk(
                          {
                            id: operation.perkId,
                            updatedAt: new Date(),
                            status: CustomerUnlockedPerkStatus.Expired
                          }
                        );
                      default:
                        // THIS should never happen
                        throw new Error('Unknown perk operation status');
                    }
                  })
                ])
              )
            );
          })
      };
    })
  }
) {}

/**
 * Extracts the perks that should be unlocked from the subscriptions and are not already unlocked.
 *
 * @param unlockedPerks - The unlocked perks for the customer.
 * @param unlockablePerks - The unlockable perks for the customer.
 * @param subscriptions - The subscriptions for the customer.
 * @returns The perks that should be unlocked.
 */
const extractPerksToUnlockFromSubscriptions = (
  unlockedPerks: CustomerUnlockedPerk[],
  unlockablePerks: ProductPerk[],
  subscriptions: (Subscription & {
    paymentProviderConfigurationProduct: PaymentProviderConfigurationProduct;
  })[]
): (PerkOperationCreation | PerkOperationReactivation)[] => {
  const subscriptionsWithRelations = enrichSubscriptionsWithPerks(
    subscriptions,
    unlockedPerks,
    unlockablePerks
  );

  return subscriptionsWithRelations.flatMap((subscription) => {
    // If the subscription is not active, we don't need to unlock any perks.
    if (subscription.status !== SubscriptionStatus.Active) {
      return [];
    }

    // Filter out the perks that are already unlocked.
    const perksToUnlock = subscription.unlockablePerks.filter(
      (unlockablePerk) =>
        !subscription.unlockedPerks
          .filter(
            (unlockedPerk) =>
              unlockedPerk.status === CustomerUnlockedPerkStatus.Active
          )
          .some((unlockedPerk) => unlockedPerk.perkId === unlockablePerk.perkId)
    );

    const perksToUnlockByCreation = perksToUnlock
      .filter((perk) => {
        const existingPerk = subscription.unlockedPerks.find(
          (unlockedPerk) => unlockedPerk.perkId === perk.perkId
        );
        return !existingPerk;
      })
      .map((perk) => ({
        perkId: perk.perkId,
        unlockedBySubscriptionId: subscription.id,
        expiresAt: subscription.expiresAt,
        status: 'create' as const
      }));

    const perksToUnlockByReactivation = perksToUnlock
      .filter((perk) => {
        const existingPerk = subscription.unlockedPerks.find(
          (unlockedPerk) => unlockedPerk.perkId === perk.perkId
        );
        return (
          existingPerk &&
          existingPerk.status === CustomerUnlockedPerkStatus.Expired
        );
      })
      .map((perk) => ({
        perkId: perk.perkId,
        unlockedBySubscriptionId: subscription.id,
        expiresAt: subscription.expiresAt,
        status: 'reactivate' as const
      }));

    return [...perksToUnlockByCreation, ...perksToUnlockByReactivation];
  });
};

/**
 * Extracts the perks that should be deactivated from the subscriptions.
 *
 * @param unlockedPerks - The unlocked perks for the customer.
 * @param subscriptions - The subscriptions for the customer.
 * @returns The perks that should be deactivated.
 */
const extractPerksToDeactivateFromSubscriptions = (
  unlockedPerks: CustomerUnlockedPerk[],
  unlockablePerks: ProductPerk[],
  subscriptions: (Subscription & {
    paymentProviderConfigurationProduct: PaymentProviderConfigurationProduct;
  })[]
): PerkOperation[] => {
  const subscriptionsWithRelations = enrichSubscriptionsWithPerks(
    subscriptions,
    unlockedPerks,
    unlockablePerks
  );

  return subscriptionsWithRelations.flatMap((subscription) => {
    if (subscription.status !== SubscriptionStatus.Active) {
      // We will deactivate all perks for inactive subscriptions.
      return subscription.unlockedPerks.map((unlockedPerk) => ({
        perkId: unlockedPerk.perkId,
        unlockedBySubscriptionId: subscription.id,
        status: 'expire'
      }));
    }

    // Deactive all perks that subscription is not entitled to. This can happen if the perks were removed from the product.
    const perksToDeactivate = subscription.unlockedPerks
      // Filter out the perks that are still entitled to.
      .filter((unlockedPerk) => {
        const perk = subscription.unlockablePerks.find(
          (perk) => perk.perkId === unlockedPerk.perkId
        );
        return !perk;
      })
      .map((unlockedPerk) => ({
        ...unlockedPerk,
        status: CustomerUnlockedPerkStatus.Expired
      }));

    return perksToDeactivate.map((perk) => ({
      perkId: perk.perkId,
      unlockedBySubscriptionId: subscription.id,
      status: 'expire'
    }));
  });
};

const enrichSubscriptionsWithPerks = (
  subscriptions: Subscription[],
  unlockedPerks: CustomerUnlockedPerk[],
  unlockablePerks: ProductPerk[]
) => {
  return subscriptions.map((subscription) => ({
    ...subscription,
    unlockedPerks: unlockedPerks.filter(
      (unlockedPerk) =>
        unlockedPerk.unlockedBySubscriptionId === subscription.id
    ),
    unlockablePerks: unlockablePerks.filter(
      (unlockablePerk) =>
        unlockablePerk.productId ===
        subscription.paymentProviderConfigurationProductId
    )
  }));
};
