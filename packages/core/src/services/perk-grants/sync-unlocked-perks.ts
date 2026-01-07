import {
  CustomerUnlockedPerkStatus,
  type InsertCustomerUnlockedPerk,
  customerUnlockedPerks,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  productPerks,
  products,
  subscriptions,
} from "@voidhash/db";
import { Db, TransactionContext } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import { PerkGrantServiceError } from "@voidhash/shared";
import { Effect } from "effect";

import {
  extractPerksToDeactivateFromSubscriptions,
  extractPerksToUnlockFromSubscriptions,
} from "./utils";

const _getCustomersUnlockedPerks = (db: Db) =>
  db.makeQuery((execute, customerId: string) =>
    execute(
      async (db) =>
        await db.query.customerUnlockedPerks.findMany({
          where: eq(customerUnlockedPerks.customerId, customerId),
        })
    )
  );

const _getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct = (
  db: Db
) =>
  db.makeQuery((execute, customerId: string) =>
    execute(
      async (db) =>
        await db.query.subscriptions.findMany({
          where: eq(subscriptions.customerId, customerId),
          with: {
            paymentProviderConfigurationProduct: true,
          },
        })
    )
  );

const _getProductPerksByPaymentProviderConfigurationProductIds = (db: Db) =>
  db.makeQuery((execute, paymentProviderConfigurationProductIds: string[]) =>
    execute(async (db) =>
      (
        await db
          .select()
          .from(paymentProviderConfigurationProducts)
          .innerJoin(
            products,
            eq(paymentProviderConfigurationProducts.productId, products.id)
          )
          .innerJoin(productPerks, eq(productPerks.productId, products.id))
          .where(
            inArray(
              paymentProviderConfigurationProducts.id,
              paymentProviderConfigurationProductIds
            )
          )
      ).map((row) => row.product_perk)
    )
  );

const _createCustomerUnlockedPerk = (db: Db) =>
  db.makeQuery((execute, customerUnlockedPerk: InsertCustomerUnlockedPerk) =>
    execute(async (db) => {
      await db.insert(customerUnlockedPerks).values(customerUnlockedPerk);
      return { id: customerUnlockedPerk.id };
    })
  );

const _updateCustomerUnlockedPerk = (db: Db) =>
  db.makeQuery(
    (
      execute,
      customerUnlockedPerk: Omit<
        Partial<import("@voidhash/db").CustomerUnlockedPerk>,
        "id"
      > & { id: string }
    ) =>
      execute(async (db) => {
        await db
          .update(customerUnlockedPerks)
          .set(customerUnlockedPerk)
          .where(eq(customerUnlockedPerks.id, customerUnlockedPerk.id));
        return { id: customerUnlockedPerk.id };
      })
  );

export const syncUnlockedPerks = Effect.gen(function* syncUnlockedPerks() {
  const db = yield* Db;
  return Effect.fn("syncUnlockedPerks")(
    function* syncUnlockedPerks(customerId: string) {
      const [unlockedPerks, customersSubscriptions] = yield* Effect.all([
        _getCustomersUnlockedPerks(db)(customerId),
        _getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct(
          db
        )(customerId),
      ]);
      const unlockablePerks =
        yield* _getProductPerksByPaymentProviderConfigurationProductIds(db)(
          customersSubscriptions.map(
            (subscription) => subscription.paymentProviderConfigurationProductId
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
        ...perksFromSubscriptionsToDeactivate,
      ];

      yield* db.transaction((tx) =>
        TransactionContext.provide(tx)(
          Effect.all(
            operations.map((operation) => {
              switch (operation.status) {
                case "create": {
                  return _createCustomerUnlockedPerk(db)({
                    customerId,
                    expiresAt: operation.expiresAt,
                    id: generateId("customerUnlockedPerk"),
                    perkId: operation.perkId,
                    status: CustomerUnlockedPerkStatus.Active,
                    unlockedBySubscriptionId:
                      operation.unlockedBySubscriptionId,
                  });
                }
                case "reactivate": {
                  return _updateCustomerUnlockedPerk(db)({
                    expiresAt: operation.expiresAt,
                    id: operation.perkId,
                    status: CustomerUnlockedPerkStatus.Active,
                    updatedAt: new Date(),
                  });
                }
                case "expire": {
                  return _updateCustomerUnlockedPerk(db)({
                    id: operation.perkId,
                    status: CustomerUnlockedPerkStatus.Expired,
                    updatedAt: new Date(),
                  });
                }
                default: {
                  // THIS should never happen
                  throw new Error("Unknown perk operation status");
                }
              }
            })
          )
        )
      );
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkGrantServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
