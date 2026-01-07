import {
  type CustomerUnlockedPerk,
  CustomerUnlockedPerkStatus,
  type PaymentProviderConfigurationProduct,
  type ProductPerk,
  type Subscription,
} from "@voidhash/db";
import { SubscriptionStatus } from "@voidhash/lib/constants";

export interface PerkOperationCreation {
  status: "create";
  perkId: string;
  unlockedBySubscriptionId: string;
  expiresAt: Date | null;
}

export interface PerkOperationReactivation {
  status: "reactivate";
  perkId: string;
  unlockedBySubscriptionId: string;
  expiresAt: Date | null;
}

export interface PerkOperationExpiration {
  status: "expire";
  perkId: string;
  unlockedBySubscriptionId: string;
}

export type PerkOperation =
  | PerkOperationCreation
  | PerkOperationReactivation
  | PerkOperationExpiration;

/**
 * Extracts the perks that should be unlocked from the subscriptions and are not already unlocked.
 *
 * @param unlockedPerks - The unlocked perks for the customer.
 * @param unlockablePerks - The unlockable perks for the customer.
 * @param subscriptions - The subscriptions for the customer.
 * @returns The perks that should be unlocked.
 */
export const extractPerksToUnlockFromSubscriptions = (
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
        expiresAt: subscription.expiresAt,
        perkId: perk.perkId,
        status: "create" as const,
        unlockedBySubscriptionId: subscription.id,
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
        expiresAt: subscription.expiresAt,
        perkId: perk.perkId,
        status: "reactivate" as const,
        unlockedBySubscriptionId: subscription.id,
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
export const extractPerksToDeactivateFromSubscriptions = (
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
        status: "expire",
        unlockedBySubscriptionId: subscription.id,
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
        status: CustomerUnlockedPerkStatus.Expired,
      }));

    return perksToDeactivate.map((perk) => ({
      perkId: perk.perkId,
      status: "expire",
      unlockedBySubscriptionId: subscription.id,
    }));
  });
};

const enrichSubscriptionsWithPerks = (
  subscriptions: Subscription[],
  unlockedPerks: CustomerUnlockedPerk[],
  unlockablePerks: ProductPerk[]
) =>
  subscriptions.map((subscription) => ({
    ...subscription,
    unlockedPerks: unlockedPerks.filter(
      (unlockedPerk) =>
        unlockedPerk.unlockedBySubscriptionId === subscription.id
    ),
    unlockablePerks: unlockablePerks.filter(
      (unlockablePerk) =>
        unlockablePerk.productId ===
        subscription.paymentProviderConfigurationProductId
    ),
  }));
