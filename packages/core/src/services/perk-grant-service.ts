import {
  type CustomerUnlockedPerk,
  CustomerUnlockedPerkStatus,
  customerUnlockedPerks,
  eq,
  type InsertCustomerUnlockedPerk,
  inArray,
  type PaymentProviderConfigurationProduct,
  type ProductPerk,
  paymentProviderConfigurationProducts,
  productPerks,
  products,
  type Subscription,
  subscriptions
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { SubscriptionStatus } from '@voidhash/lib/constants';
import { PerkGrantServiceError } from '@voidhash/shared';
import { Effect, pipe } from 'effect';

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
      const dbService = yield* Db;

      const _getCustomersUnlockedPerks = dbService.makeQuery(
        (execute, customerId: string) =>
          execute(
            async (db) =>
              await db.query.customerUnlockedPerks.findMany({
                where: eq(customerUnlockedPerks.customerId, customerId)
              })
          )
      );

      const _getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct =
        dbService.makeQuery((execute, customerId: string) =>
          execute(
            async (db) =>
              await db.query.subscriptions.findMany({
                where: eq(subscriptions.customerId, customerId),
                with: {
                  paymentProviderConfigurationProduct: true
                }
              })
          )
        );

      const _getProductPerksByPaymentProviderConfigurationProductIds =
        dbService.makeQuery(
          (execute, paymentProviderConfigurationProductIds: string[]) =>
            execute(async (db) =>
              (
                await db
                  .select()
                  .from(paymentProviderConfigurationProducts)
                  .innerJoin(
                    products,
                    eq(
                      paymentProviderConfigurationProducts.productId,
                      products.id
                    )
                  )
                  .innerJoin(
                    productPerks,
                    eq(productPerks.productId, products.id)
                  )
                  .where(
                    inArray(
                      paymentProviderConfigurationProducts.id,
                      paymentProviderConfigurationProductIds
                    )
                  )
              ).map((row) => row.product_perk)
            )
        );

      const _createCustomerUnlockedPerk = dbService.makeQuery(
        (execute, customerUnlockedPerk: InsertCustomerUnlockedPerk) =>
          execute(async (db) => {
            await db.insert(customerUnlockedPerks).values(customerUnlockedPerk);
            return { id: customerUnlockedPerk.id };
          })
      );

      const _updateCustomerUnlockedPerk = dbService.makeQuery(
        (
          execute,
          customerUnlockedPerk: Omit<Partial<CustomerUnlockedPerk>, 'id'> & {
            id: string;
          }
        ) =>
          execute(async (db) => {
            await db
              .update(customerUnlockedPerks)
              .set(customerUnlockedPerk)
              .where(eq(customerUnlockedPerks.id, customerUnlockedPerk.id));
            return { id: customerUnlockedPerk.id };
          })
      );

      const syncUnlockedPerks = (customerId: string) =>
        pipe(
          Effect.gen(function* () {
            const [unlockedPerks, customersSubscriptions] = yield* Effect.all([
              _getCustomersUnlockedPerks(customerId),
              _getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct(
                customerId
              )
            ]);
            const unlockablePerks =
              yield* _getProductPerksByPaymentProviderConfigurationProductIds(
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

            yield* dbService.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.all([
                  ...operations.map((operation) => {
                    switch (operation.status) {
                      case 'create':
                        return _createCustomerUnlockedPerk({
                          id: generateId('customerUnlockedPerk'),
                          customerId,
                          perkId: operation.perkId,
                          unlockedBySubscriptionId:
                            operation.unlockedBySubscriptionId,
                          expiresAt: operation.expiresAt,
                          status: CustomerUnlockedPerkStatus.Active
                        });
                      case 'reactivate':
                        return _updateCustomerUnlockedPerk({
                          id: operation.perkId,
                          expiresAt: operation.expiresAt,
                          updatedAt: new Date(),
                          status: CustomerUnlockedPerkStatus.Active
                        });
                      case 'expire':
                        return _updateCustomerUnlockedPerk({
                          id: operation.perkId,
                          updatedAt: new Date(),
                          status: CustomerUnlockedPerkStatus.Expired
                        });
                      default:
                        // THIS should never happen
                        throw new Error('Unknown perk operation status');
                    }
                  })
                ])
              )
            );
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new PerkGrantServiceError({
                cause: String(error.cause)
              })
          })
        );

      return {
        syncUnlockedPerks
      } as const;
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
