import { SubscriptionStatus } from "@voidhash/lib";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { PersonNotFoundError } from "../../domain/person/Person.ts";
import {
  type InsertPersonUnlockedPerk,
  type PaymentProviderConfigurationProduct as DbPaymentProviderConfigurationProduct,
  type Purchase as DbPurchase,
  type Subscription as DbSubscription,
  Db,
  type DbTransaction,
  PersonUnlockedPerkStatus,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  personUnlockedPerks,
  productPerks,
  products,
  purchases,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { RequestEnvironmentMode } from "../requestEnvironment/RequestEnvironmentMode.ts";
// The SDK snapshot's grant projection is the canonical one. Importing it here
// (rather than re-deriving it) is what keeps `sdk.getPerson` and the
// secret-key entitlements endpoint from ever disagreeing about a person.
import { dedupeGrants, mapGrant, sortGrants } from "../sdk/snapshot-builder.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` and other infrastructural
 * failures at the public-method boundary so callers see one stable error tag.
 */
export class PerkGrantServiceError extends Schema.TaggedErrorClass<PerkGrantServiceError>(
  "PerkGrantServiceError",
)("PerkGrantServiceError", { cause: Schema.String }) {}

type SubscriptionWithProduct = DbSubscription & {
  readonly paymentProviderConfigurationProduct: DbPaymentProviderConfigurationProduct;
};

type PurchaseWithProduct = DbPurchase & {
  readonly paymentProviderConfigurationProduct: DbPaymentProviderConfigurationProduct;
};

/**
 * Internal sync-step description, computed entirely in memory from the
 * existing unlocked-perks state and the desired entitlements before any DB
 * write happens. Keeps the transaction body trivial — one switch over the
 * operation tag — and makes the reconciliation logic unit-testable without a
 * real DB.
 */
type SyncPerkOperation =
  | {
      readonly status: "subscription-create";
      readonly perkId: string;
      readonly environment: number;
      readonly unlockedBySubscriptionId: string;
      readonly expiresAt: Date | null;
    }
  | {
      readonly status: "subscription-reactivate";
      readonly id: string;
      readonly perkId: string;
      readonly environment: number;
      readonly unlockedBySubscriptionId: string;
      readonly expiresAt: Date | null;
    }
  | {
      readonly status: "purchase-create";
      readonly perkId: string;
      readonly environment: number;
      readonly purchaseId: string;
    }
  | {
      readonly status: "purchase-reactivate";
      readonly id: string;
      readonly perkId: string;
      readonly environment: number;
      readonly purchaseId: string;
    }
  | {
      readonly status: "expire";
      readonly id: string;
      readonly perkId: string;
      readonly environment: number;
    };

type DesiredPerkEntitlement =
  | {
      readonly source: "purchase";
      readonly perkId: string;
      readonly purchaseId: string;
      readonly environment: number;
    }
  | {
      readonly source: "subscription";
      readonly perkId: string;
      readonly subscriptionId: string;
      readonly expiresAt: Date | null;
      readonly environment: number;
    };

const entitlementKey = (environment: number, perkId: string) => `${environment}:${perkId}`;

const sameDate = (left: Date | null, right: Date | null) =>
  left === right || (left !== null && right !== null && left.getTime() === right.getTime());

/**
 * `PerkGrantService` reconciles a person's `personUnlockedPerks` against
 * their active subscriptions, one-time purchases, and the product-perk
 * catalog.
 *
 * - `syncUnlockedPerks(tx, personId)` — runs the reconciliation on the caller's
 *   transaction handle (so it reads and writes atomically with the surrounding
 *   purchase write) and returns the grant ids that were created or updated.
 * - `getPersonUnlockedPerks(personId)` — returns the unlocked perks for a
 *   person, behind a `project:all` permission check.
 * - `getPersonEntitlementGrants(personId)` — the same rows projected into the
 *   public grant shape the SDK person snapshot reports.
 *
 * `AuthSession` and `Db` are provided by the application root.
 */
export class PerkGrantService extends Context.Service<PerkGrantService>()("PerkGrantService", {
  make: Effect.sync(() => {
    const syncUnlockedPerks = Effect.fn("syncUnlockedPerks")(
      function* (tx: DbTransaction, personId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
        const [unlockedPerks, personSubscriptions, personPurchases] = yield* Effect.all([
          Effect.gen(function* () {
            return yield* tx.query.personUnlockedPerks.findMany({
              where: { personId },
            });
          }),
          Effect.gen(function* () {
            const rows = yield* tx.query.subscriptions.findMany({
              where: { personId },
              with: { paymentProviderConfigurationProduct: true },
            });
            // The product foreign key is non-null, so the relation always
            // resolves; narrowing it here is what keeps the row type precise.
            return rows.flatMap((row): ReadonlyArray<SubscriptionWithProduct> => {
              const product = row.paymentProviderConfigurationProduct;
              if (!product) {
                return [];
              }
              return [{ ...row, paymentProviderConfigurationProduct: product }];
            });
          }),
          Effect.gen(function* () {
            const rows = yield* tx
              .select({
                paymentProviderConfigurationProduct: paymentProviderConfigurationProducts,
                purchase: purchases,
              })
              .from(purchases)
              .innerJoin(
                paymentProviderConfigurationProducts,
                eq(
                  purchases.paymentProviderConfigurationProductId,
                  paymentProviderConfigurationProducts.id,
                ),
              )
              .where(eq(purchases.personId, personId));
            return rows.map(
              (row): PurchaseWithProduct => ({
                ...row.purchase,
                paymentProviderConfigurationProduct: row.paymentProviderConfigurationProduct,
              }),
            );
          }),
        ]);

        const activePurchases = personPurchases.filter(
          (purchase) => purchase.refundedAt === null && purchase.revokedAt === null,
        );
        const configurationProductIds = [
          ...personSubscriptions.map((sub) => sub.paymentProviderConfigurationProductId),
          ...activePurchases.map((p) => p.paymentProviderConfigurationProductId),
        ];

        yield* Effect.annotateCurrentSpan(
          "voidhash.subscription.count",
          personSubscriptions.length,
        );
        yield* Effect.annotateCurrentSpan("voidhash.purchase.count", activePurchases.length);
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.product_config.ids",
          configurationProductIds.slice(0, 20).join(","),
        );

        const unlockablePerks = yield* Effect.gen(function* () {
          if (configurationProductIds.length === 0) {
            return [];
          }
          const rows = yield* tx
            .select()
            .from(paymentProviderConfigurationProducts)
            .innerJoin(products, eq(paymentProviderConfigurationProducts.productId, products.id))
            .innerJoin(productPerks, eq(productPerks.productId, products.id))
            .where(inArray(paymentProviderConfigurationProducts.id, configurationProductIds));
          return rows.map((row) => row.product_perk);
        });

        const desiredByEnvironmentAndPerk = new Map<string, DesiredPerkEntitlement>();

        for (const purchase of activePurchases) {
          for (const productPerk of unlockablePerks) {
            if (
              productPerk.productId === purchase.paymentProviderConfigurationProduct.productId &&
              !desiredByEnvironmentAndPerk.has(
                entitlementKey(purchase.providerEnvironment, productPerk.perkId),
              )
            ) {
              desiredByEnvironmentAndPerk.set(
                entitlementKey(purchase.providerEnvironment, productPerk.perkId),
                {
                  environment: purchase.providerEnvironment,
                  perkId: productPerk.perkId,
                  purchaseId: purchase.id,
                  source: "purchase",
                },
              );
            }
          }
        }

        for (const subscription of personSubscriptions) {
          if (subscription.status !== SubscriptionStatus.Active) {
            continue;
          }
          for (const productPerk of unlockablePerks) {
            if (
              productPerk.productId ===
                subscription.paymentProviderConfigurationProduct.productId &&
              !desiredByEnvironmentAndPerk.has(
                entitlementKey(subscription.providerEnvironment, productPerk.perkId),
              )
            ) {
              desiredByEnvironmentAndPerk.set(
                entitlementKey(subscription.providerEnvironment, productPerk.perkId),
                {
                  environment: subscription.providerEnvironment,
                  expiresAt: subscription.expiresAt,
                  perkId: productPerk.perkId,
                  source: "subscription",
                  subscriptionId: subscription.id,
                },
              );
            }
          }
        }

        const desiredPerkIds = [...desiredByEnvironmentAndPerk.values()].map(
          (entitlement) => entitlement.perkId,
        );
        yield* Effect.annotateCurrentSpan("voidhash.perk.count", desiredPerkIds.length);
        yield* Effect.annotateCurrentSpan(
          "voidhash.perk.ids",
          desiredPerkIds.slice(0, 20).join(","),
        );

        const desiredOperations = [...desiredByEnvironmentAndPerk.values()].flatMap(
          (entitlement): SyncPerkOperation[] => {
            const existingPerk = unlockedPerks.find(
              (unlockedPerk) =>
                unlockedPerk.perkId === entitlement.perkId &&
                unlockedPerk.environment === entitlement.environment,
            );
            if (!existingPerk) {
              if (entitlement.source === "purchase") {
                return [
                  {
                    perkId: entitlement.perkId,
                    environment: entitlement.environment,
                    purchaseId: entitlement.purchaseId,
                    status: "purchase-create",
                  },
                ];
              }
              return [
                {
                  expiresAt: entitlement.expiresAt,
                  environment: entitlement.environment,
                  perkId: entitlement.perkId,
                  status: "subscription-create",
                  unlockedBySubscriptionId: entitlement.subscriptionId,
                },
              ];
            }

            if (entitlement.source === "purchase") {
              if (
                existingPerk.status !== PersonUnlockedPerkStatus.Active ||
                existingPerk.unlockedByPurchaseId !== entitlement.purchaseId ||
                existingPerk.unlockedBySubscriptionId !== null ||
                existingPerk.expiresAt !== null
              ) {
                return [
                  {
                    id: existingPerk.id,
                    environment: entitlement.environment,
                    perkId: entitlement.perkId,
                    purchaseId: entitlement.purchaseId,
                    status: "purchase-reactivate",
                  },
                ];
              }
              return [];
            }

            if (
              existingPerk.status !== PersonUnlockedPerkStatus.Active ||
              existingPerk.unlockedBySubscriptionId !== entitlement.subscriptionId ||
              existingPerk.unlockedByPurchaseId !== null ||
              !sameDate(existingPerk.expiresAt, entitlement.expiresAt)
            ) {
              return [
                {
                  expiresAt: entitlement.expiresAt,
                  environment: entitlement.environment,
                  id: existingPerk.id,
                  perkId: entitlement.perkId,
                  status: "subscription-reactivate",
                  unlockedBySubscriptionId: entitlement.subscriptionId,
                },
              ];
            }
            return [];
          },
        );

        const expireOperations: ReadonlyArray<SyncPerkOperation> = unlockedPerks
          .filter(
            (unlockedPerk) =>
              unlockedPerk.status === PersonUnlockedPerkStatus.Active &&
              (unlockedPerk.unlockedByPurchaseId !== null ||
                unlockedPerk.unlockedBySubscriptionId !== null) &&
              !desiredByEnvironmentAndPerk.has(
                entitlementKey(unlockedPerk.environment, unlockedPerk.perkId),
              ),
          )
          .map(
            (unlockedPerk): SyncPerkOperation => ({
              id: unlockedPerk.id,
              environment: unlockedPerk.environment,
              perkId: unlockedPerk.perkId,
              status: "expire",
            }),
          );

        const operations: ReadonlyArray<SyncPerkOperation> = [
          ...desiredOperations,
          ...expireOperations,
        ];

        const createdCount = operations.filter(
          (operation) =>
            operation.status === "subscription-create" || operation.status === "purchase-create",
        ).length;
        const updatedCount = operations.filter(
          (operation) =>
            operation.status === "subscription-reactivate" ||
            operation.status === "purchase-reactivate",
        ).length;
        const expiredCount = operations.filter((operation) => operation.status === "expire").length;

        yield* Effect.annotateCurrentSpan(
          "voidhash.perk_grant.operations.count",
          operations.length,
        );
        yield* Effect.annotateCurrentSpan("voidhash.perk_grant.created_count", createdCount);
        yield* Effect.annotateCurrentSpan("voidhash.perk_grant.updated_count", updatedCount);
        yield* Effect.annotateCurrentSpan("voidhash.perk_grant.expired_count", expiredCount);

        const now = yield* DateTime.nowAsDate;
        const writtenIds = yield* Effect.all(
          operations.map((operation) => {
            switch (operation.status) {
              case "subscription-create": {
                const newPerk: InsertPersonUnlockedPerk = {
                  personId,
                  environment: operation.environment,
                  expiresAt: operation.expiresAt,
                  id: generateId("personUnlockedPerk"),
                  perkId: operation.perkId,
                  status: PersonUnlockedPerkStatus.Active,
                  unlockedBySubscriptionId: operation.unlockedBySubscriptionId,
                };
                return tx.insert(personUnlockedPerks).values(newPerk).pipe(Effect.as(newPerk.id));
              }
              case "subscription-reactivate": {
                return tx
                  .update(personUnlockedPerks)
                  .set({
                    expiresAt: operation.expiresAt,
                    status: PersonUnlockedPerkStatus.Active,
                    unlockedBySubscriptionId: operation.unlockedBySubscriptionId,
                    unlockedByPurchaseId: null,
                    updatedAt: now,
                  })
                  .where(eq(personUnlockedPerks.id, operation.id))
                  .pipe(Effect.as(operation.id));
              }
              case "expire": {
                return tx
                  .update(personUnlockedPerks)
                  .set({
                    status: PersonUnlockedPerkStatus.Expired,
                    updatedAt: now,
                  })
                  .where(eq(personUnlockedPerks.id, operation.id))
                  .pipe(Effect.as(operation.id));
              }
              case "purchase-create": {
                const newPerk: InsertPersonUnlockedPerk = {
                  expiresAt: null,
                  environment: operation.environment,
                  id: generateId("personUnlockedPerk"),
                  perkId: operation.perkId,
                  personId,
                  status: PersonUnlockedPerkStatus.Active,
                  unlockedByPurchaseId: operation.purchaseId,
                };
                return tx.insert(personUnlockedPerks).values(newPerk).pipe(Effect.as(newPerk.id));
              }
              case "purchase-reactivate": {
                return tx
                  .update(personUnlockedPerks)
                  .set({
                    expiresAt: null,
                    status: PersonUnlockedPerkStatus.Active,
                    unlockedByPurchaseId: operation.purchaseId,
                    unlockedBySubscriptionId: null,
                    updatedAt: now,
                  })
                  .where(eq(personUnlockedPerks.id, operation.id))
                  .pipe(Effect.as(operation.id));
              }
            }
          }),
        );

        yield* Effect.annotateCurrentSpan("voidhash.perk_grant.result.count", writtenIds.length);

        return writtenIds;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkGrantServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getPersonUnlockedPerks = Effect.fn("getPersonUnlockedPerks")(
      function* (personId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
        const session = yield* AuthSession;
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const environmentMode = yield* RequestEnvironmentMode;
        const [person, perks] = yield* Effect.all(
          [
            Effect.gen(function* () {
              const db = yield* Db;
              return yield* db.query.persons.findFirst({ where: { id: personId } });
            }),
            Effect.gen(function* () {
              const db = yield* Db;
              return yield* db.query.personUnlockedPerks.findMany({
                where: {
                  personId,
                  environment: { in: [...environmentMode.providerEnvironments] },
                },
              });
            }),
          ],
          { concurrency: "unbounded" },
        );
        if (!person) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
        yield* checkProjectPermission(
          person.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${personId} for project ${person.projectId}`,
        );
        return perks;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkGrantServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /**
     * A person's entitlement grants in the public SDK shape: the same
     * `dedupe → map → sort` projection `sdk.getPerson` applies to its snapshot,
     * over the same environment-scoped rows and behind the same `project:all`
     * check as {@link getPersonUnlockedPerks}.
     */
    const getPersonEntitlementGrants = Effect.fn("getPersonEntitlementGrants")(function* (
      personId: string,
    ) {
      const unlockedPerks = yield* getPersonUnlockedPerks(personId);
      const grants = sortGrants(dedupeGrants(unlockedPerks).map(mapGrant));
      yield* Effect.annotateCurrentSpan("voidhash.perk_grant.result.count", grants.length);
      return grants;
    });

    return constant({
      getPersonEntitlementGrants,
      getPersonUnlockedPerks,
      syncUnlockedPerks,
    });
  }),
}) {
  static layer = Layer.effect(PerkGrantService)(PerkGrantService.make);
}
