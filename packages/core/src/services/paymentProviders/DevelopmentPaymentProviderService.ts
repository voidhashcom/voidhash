import {
  Db,
  PersonOrigin,
  ProviderEnvironment,
  and,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  personUnlockedPerks,
  projects,
  purchaseLedger,
  purchases,
  subscriptions,
  transactions,
  type Product,
  type Purchase,
  type Subscription,
} from "@voidhash/db";
import { ProductType, type ProductTypeValue, type SubscriptionDurationValue } from "@voidhash/lib";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import type { PurchaseProcessingResult } from "../../domain/purchaseProcessing/PurchaseProcessing.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { PersonIdentityService } from "../personIdentity/PersonIdentityService.ts";
import {
  PurchaseProcessingService,
  type PurchaseActionContext,
} from "../purchaseProcessing/PurchaseProcessingService.ts";
import {
  addDevelopmentBillingPeriod,
  getDevelopmentPrice,
  makeDevelopmentMoney,
} from "./development/pricing.ts";

export class DevelopmentPaymentProviderServiceError extends Schema.TaggedErrorClass<DevelopmentPaymentProviderServiceError>(
  "DevelopmentPaymentProviderServiceError",
)("DevelopmentPaymentProviderServiceError", { message: Schema.String }) {}

export interface DevelopmentPurchaseResult {
  readonly result: PurchaseProcessingResult;
  readonly warning: string | null;
}

const asProductType = (value: any): ProductTypeValue => value;
const asDuration = (value: any): SubscriptionDurationValue | null => value;

/** Synthetic payment provider used by debug SDK builds. */
export class DevelopmentPaymentProviderService extends Context.Service<DevelopmentPaymentProviderService>()(
  "DevelopmentPaymentProviderService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const identities = yield* PersonIdentityService;
      const purchaseProcessing = yield* PurchaseProcessingService;

      const ensureConfigurationProduct = (projectId: string, product: Product) =>
        db.transaction((tx) =>
          Effect.gen(function* () {
            let configuration = yield* tx.query.paymentProviderConfigurations.findFirst({
              where: { projectId, providerId: "development", deletedAt: { isNull: true } },
            });
            if (!configuration) {
              yield* tx
                .insert(paymentProviderConfigurations)
                .values({
                  configuration: {},
                  enabled: true,
                  id: generateId("paymentProviderConfiguration"),
                  name: "Development",
                  paymentProviderKey: projectId,
                  projectId,
                  providerId: "development",
                })
                .onConflictDoNothing();
              configuration = yield* tx.query.paymentProviderConfigurations.findFirst({
                where: { projectId, providerId: "development", deletedAt: { isNull: true } },
              });
            }
            if (!configuration) {
              return yield* Effect.fail(
                new DevelopmentPaymentProviderServiceError({
                  message: "Could not provision the development provider",
                }),
              );
            }

            let mapping = yield* tx.query.paymentProviderConfigurationProducts.findFirst({
              where: {
                paymentProviderConfigurationId: configuration.id,
                productId: product.id,
                providerProductKey: product.slug,
              },
            });
            if (!mapping) {
              yield* tx
                .insert(paymentProviderConfigurationProducts)
                .values({
                  configuration: {},
                  id: generateId("paymentProviderProduct"),
                  isActive: true,
                  paymentProviderConfigurationId: configuration.id,
                  productId: product.id,
                  providerProductKey: product.slug,
                })
                .onConflictDoNothing();
              mapping = yield* tx.query.paymentProviderConfigurationProducts.findFirst({
                where: {
                  paymentProviderConfigurationId: configuration.id,
                  productId: product.id,
                  providerProductKey: product.slug,
                },
              });
            }
            if (!mapping) {
              return yield* Effect.fail(
                new DevelopmentPaymentProviderServiceError({
                  message: "Could not provision the development product mapping",
                }),
              );
            }
            return { configuration, mapping };
          }),
        );

      const processSdkPurchase = Effect.fn("development.processSdkPurchase")(
        function* (input: {
          readonly distinctId: string;
          readonly projectId: string;
          readonly productSlug: string;
          readonly devTransactionId: string;
          readonly purchaseDate: Date;
          readonly quantity?: number;
        }) {
          const project = yield* db.query.projects.findFirst({ where: { id: input.projectId } });
          if (!project) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Project not found" }),
            );
          }
          if (!project.developmentPurchasesEnabled) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Development purchases are disabled for this project",
              }),
            );
          }
          const product = yield* db.query.products.findFirst({
            where: { projectId: input.projectId, slug: input.productSlug },
          });
          if (!product) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Product not found" }),
            );
          }
          const quantity = input.quantity ?? 1;
          if (!Number.isInteger(quantity) || quantity < 1) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Quantity must be a positive integer",
              }),
            );
          }
          if (product.type !== ProductType.OneTimeConsumable && quantity !== 1) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Quantity is only supported for consumable products",
              }),
            );
          }

          const identity = yield* identities.resolveDistinctId({
            distinctId: input.distinctId,
            eventId: input.devTransactionId,
            eventTimestamp: input.purchaseDate,
            origin: PersonOrigin.API,
            projectId: input.projectId,
            setAttributes: {},
            setOnceAttributes: {},
            shouldCreatePerson: true,
          });
          const personId = identity.identity.personId;
          if (!personId) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Could not resolve person" }),
            );
          }
          const { configuration, mapping } = yield* ensureConfigurationProduct(
            input.projectId,
            product,
          );
          const price = getDevelopmentPrice(
            asProductType(product.type),
            asDuration(product.duration),
          );
          const now = yield* DateTime.nowAsDate;
          const providerTransactionId = `development:${input.projectId}:${input.devTransactionId}`;
          const context = {
            idempotencyKey: `dev:${configuration.id}:${input.devTransactionId}:purchase`,
            occurredAt: input.purchaseDate,
            organizationId: project.organizationId,
            paymentProviderConfigurationId: configuration.id,
            paymentProviderConfigurationProductId: mapping.id,
            personId,
            projectId: input.projectId,
            providerEnvironment: ProviderEnvironment.Development,
            providerEventType: "development.purchase",
            providerId: "development",
            providerSubscriptionId: Option.some(providerTransactionId),
            providerTransactionId: Option.some(providerTransactionId),
            providerWebhookNotificationId: Option.none<string>(),
            rawProviderPayload: Option.some({
              devTransactionId: input.devTransactionId,
              productSlug: input.productSlug,
              quantity,
            }),
            receivedAt: now,
            source: "sdk",
          } satisfies PurchaseActionContext;
          let pricedQuantity = 1;
          if (product.type === ProductType.OneTimeConsumable) {
            pricedQuantity = quantity;
          }
          const money = Option.some(makeDevelopmentMoney(price.amount * pricedQuantity));
          let result: PurchaseProcessingResult;
          if (product.type === ProductType.Subscription) {
            result = yield* purchaseProcessing.startSubscription({
              ...context,
              expiresAt: Option.some(addDevelopmentBillingPeriod(input.purchaseDate, price)),
              isTrial: false,
              money,
              purchasedAt: input.purchaseDate,
              startsAt: input.purchaseDate,
            });
          } else {
            let purchaseType: "consumable" | "one-time" = "one-time";
            if (product.type === ProductType.OneTimeConsumable) {
              purchaseType = "consumable";
            }
            result = yield* purchaseProcessing.completeOneTimePurchase({
              ...context,
              money,
              purchasedAt: input.purchaseDate,
              purchaseType,
            });
          }
          return { result, warning: price.warning } satisfies DevelopmentPurchaseResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
                ),
              PersonServiceError: (error) =>
                Effect.fail(new DevelopmentPaymentProviderServiceError({ message: error.cause })),
              PurchaseProcessingServiceError: (error) =>
                Effect.fail(new DevelopmentPaymentProviderServiceError({ message: error.cause })),
              PurchaseProcessingProductNotMappedError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({
                    message: `Development product mapping ${error.paymentProviderConfigurationProductId} is invalid`,
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
                ),
            }),
          ),
      );

      const getDevelopmentState = Effect.fn("development.getState")(
        function* (input: { readonly personId: string; readonly projectId: string }) {
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `Not authorized to inspect development purchases for ${input.projectId}`,
          );
          const [project, person] = yield* Effect.all([
            db.query.projects.findFirst({ where: { id: input.projectId } }),
            db.query.persons.findFirst({
              where: { id: input.personId, projectId: input.projectId },
            }),
          ]);
          if (!project || !person) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Person or project not found",
              }),
            );
          }
          const [subscriptionRows, purchaseRows, grantRows, catalogProducts, mappings] =
            yield* Effect.all([
              db.query.subscriptions.findMany({
                where: {
                  personId: input.personId,
                  providerEnvironment: ProviderEnvironment.Development,
                },
              }),
              db.query.purchases.findMany({
                where: {
                  personId: input.personId,
                  providerEnvironment: ProviderEnvironment.Development,
                },
              }),
              db.query.personUnlockedPerks.findMany({
                where: {
                  personId: input.personId,
                  environment: ProviderEnvironment.Development,
                },
              }),
              db.query.products.findMany({ where: { projectId: input.projectId } }),
              db
                .select({
                  id: paymentProviderConfigurationProducts.id,
                  productId: paymentProviderConfigurationProducts.productId,
                })
                .from(paymentProviderConfigurationProducts)
                .innerJoin(
                  paymentProviderConfigurations,
                  eq(
                    paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                    paymentProviderConfigurations.id,
                  ),
                )
                .where(
                  and(
                    eq(paymentProviderConfigurations.projectId, input.projectId),
                    eq(paymentProviderConfigurations.providerId, "development"),
                  ),
                ),
            ]);
          const productById = new Map(catalogProducts.map((product) => [product.id, product]));
          const productIdByMappingId = new Map(
            mappings.map((mapping) => [mapping.id, mapping.productId]),
          );
          const productDetails = (mappingId: string) => {
            const productId = productIdByMappingId.get(mappingId) ?? "";
            const product = productById.get(productId);
            return {
              productId,
              productName: product?.name ?? "Unknown product",
              productSlug: product?.slug ?? "unknown",
            };
          };
          return {
            developmentPurchasesEnabled: project.developmentPurchasesEnabled,
            grants: grantRows.map((grant) => ({
              expiresAt: grant.expiresAt,
              id: grant.id,
              perkId: grant.perkId,
              status: grant.status,
            })),
            purchases: purchaseRows.map((purchase) => ({
              createdAt: purchase.createdAt,
              id: purchase.id,
              refundedAt: purchase.refundedAt,
              revokedAt: purchase.revokedAt,
              ...productDetails(purchase.paymentProviderConfigurationProductId),
            })),
            subscriptions: subscriptionRows.map((subscription) => ({
              canceledAt: subscription.canceledAt,
              expiresAt: subscription.expiresAt,
              gracePeriodExpiresAt: subscription.gracePeriodExpiresAt,
              id: subscription.id,
              startsAt: subscription.startsAt,
              status: subscription.status,
              ...productDetails(subscription.paymentProviderConfigurationProductId),
            })),
          };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
              ),
            ),
          ),
      );

      const setDevelopmentPurchasesEnabled = Effect.fn("development.setEnabled")(
        function* (input: { readonly enabled: boolean; readonly projectId: string }) {
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `Not authorized to change development purchase settings for ${input.projectId}`,
          );
          yield* db
            .update(projects)
            .set({ developmentPurchasesEnabled: input.enabled })
            .where(eq(projects.id, input.projectId));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
              ),
            ),
          ),
      );

      const getDevelopmentSettings = Effect.fn("development.getSettings")(
        function* (projectId: string) {
          yield* checkProjectPermission(
            projectId,
            "project:all",
            `Not authorized to inspect development purchase settings for ${projectId}`,
          );
          const project = yield* db.query.projects.findFirst({ where: { id: projectId } });
          if (!project) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Project not found" }),
            );
          }
          return { developmentPurchasesEnabled: project.developmentPurchasesEnabled };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
              ),
            ),
          ),
      );

      const applyLifecycleAction = Effect.fn("development.applyLifecycleAction")(
        function* (input: {
          readonly action: "expire" | "revoke" | "renew" | "refund" | "grace_period";
          readonly actionId: string;
          readonly projectId: string;
          readonly targetId: string;
          readonly targetType: "subscription" | "purchase";
        }) {
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `Not authorized to simulate development purchases for ${input.projectId}`,
          );
          const now = yield* DateTime.nowAsDate;
          const project = yield* db.query.projects.findFirst({ where: { id: input.projectId } });
          if (!project) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Project not found" }),
            );
          }
          let subscriptionTarget: Subscription | undefined;
          let purchaseTarget: Purchase | undefined;
          if (input.targetType === "subscription") {
            subscriptionTarget = yield* db.query.subscriptions.findFirst({
              where: { id: input.targetId },
            });
          } else {
            purchaseTarget = yield* db.query.purchases.findFirst({
              where: { id: input.targetId },
            });
          }
          const target = subscriptionTarget ?? purchaseTarget;
          if (!target || target.providerEnvironment !== ProviderEnvironment.Development) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Only development purchases can be simulated",
              }),
            );
          }
          const mapping = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: { id: target.paymentProviderConfigurationProductId },
          });
          if (!mapping) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Development target not found",
              }),
            );
          }
          const [configuration, product] = yield* Effect.all([
            db.query.paymentProviderConfigurations.findFirst({
              where: { id: mapping.paymentProviderConfigurationId },
            }),
            db.query.products.findFirst({ where: { id: mapping.productId } }),
          ]);
          if (
            !configuration ||
            configuration.providerId !== "development" ||
            configuration.projectId !== input.projectId ||
            !product
          ) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: "Development target not found",
              }),
            );
          }
          const providerTransactionId =
            subscriptionTarget?.latestTransactionId ?? purchaseTarget?.providerKey;
          if (!providerTransactionId) {
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({ message: "Target has no transaction" }),
            );
          }
          let providerSubscriptionId = Option.none<string>();
          if (subscriptionTarget) {
            providerSubscriptionId = Option.some(subscriptionTarget.storeSubscriptionId);
          }
          const context = {
            idempotencyKey: `dev:${input.targetId}:${input.action}:${input.actionId}`,
            occurredAt: now,
            organizationId: project.organizationId,
            paymentProviderConfigurationId: configuration.id,
            paymentProviderConfigurationProductId: mapping.id,
            personId: target.personId,
            projectId: input.projectId,
            providerEnvironment: ProviderEnvironment.Development,
            providerEventType: `development.${input.action}`,
            providerId: "development",
            providerSubscriptionId,
            providerTransactionId: Option.some(providerTransactionId),
            providerWebhookNotificationId: Option.none<string>(),
            rawProviderPayload: Option.some({ action: input.action, actionId: input.actionId }),
            receivedAt: now,
            source: "sdk",
          } satisfies PurchaseActionContext;

          if (input.targetType === "purchase") {
            if (input.action === "refund") {
              yield* purchaseProcessing.refundPurchase({
                ...context,
                refundedAt: now,
                refundReason: Option.some("Development simulation"),
              });
              return;
            }
            if (input.action === "revoke") {
              yield* purchaseProcessing.revokePurchase({
                ...context,
                revokedAt: now,
                revocationReason: Option.some("Development simulation"),
              });
              return;
            }
            return yield* Effect.fail(
              new DevelopmentPaymentProviderServiceError({
                message: `Action ${input.action} is not valid for a purchase`,
              }),
            );
          }

          if (input.action === "expire") {
            yield* purchaseProcessing.expireSubscription({ ...context, expiredAt: now });
            return;
          }
          if (input.action === "revoke") {
            yield* purchaseProcessing.revokeSubscription({
              ...context,
              revokedAt: now,
              revocationReason: Option.some("Development simulation"),
            });
            return;
          }
          if (input.action === "grace_period") {
            const graceExpiry = DateTime.toDateUtc(
              DateTime.add(DateTime.fromDateUnsafe(now), { days: 3 }),
            );
            yield* purchaseProcessing.enterBillingRetry({
              ...context,
              billingRetryAt: now,
              gracePeriodExpiresAt: Option.some(graceExpiry),
            });
            return;
          }
          if (input.action === "renew") {
            const price = getDevelopmentPrice(
              asProductType(product.type),
              asDuration(product.duration),
            );
            let currentExpiry = now;
            if (subscriptionTarget?.expiresAt && subscriptionTarget.expiresAt > now) {
              currentExpiry = subscriptionTarget.expiresAt;
            }
            const renewalTransactionId = `development:${input.projectId}:${input.actionId}`;
            yield* purchaseProcessing.renewSubscription({
              ...context,
              expiresAt: Option.some(addDevelopmentBillingPeriod(currentExpiry, price)),
              isTrial: false,
              money: Option.some(makeDevelopmentMoney(price.amount)),
              providerTransactionId: Option.some(renewalTransactionId),
              renewedAt: now,
              startsAt: currentExpiry,
            });
            return;
          }
          return yield* Effect.fail(
            new DevelopmentPaymentProviderServiceError({
              message: `Action ${input.action} is not valid for a subscription`,
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
                ),
              PurchaseProcessingProductNotMappedError: () =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({
                    message: "Development product mapping is invalid",
                  }),
                ),
              PurchaseProcessingServiceError: (error) =>
                Effect.fail(new DevelopmentPaymentProviderServiceError({ message: error.cause })),
            }),
          ),
      );

      const resetDevelopmentData = Effect.fn("development.resetData")(
        function* (projectId: string) {
          yield* checkProjectPermission(
            projectId,
            "project:all",
            `Not authorized to reset development purchases for ${projectId}`,
          );
          const [mappings, people] = yield* Effect.all([
            db
              .select({ id: paymentProviderConfigurationProducts.id })
              .from(paymentProviderConfigurationProducts)
              .innerJoin(
                paymentProviderConfigurations,
                eq(
                  paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                  paymentProviderConfigurations.id,
                ),
              )
              .where(
                and(
                  eq(paymentProviderConfigurations.projectId, projectId),
                  eq(paymentProviderConfigurations.providerId, "development"),
                ),
              ),
            db.query.persons.findMany({ columns: { id: true }, where: { projectId } }),
          ]);
          const mappingIds = mappings.map((mapping) => mapping.id);
          const personIds = people.map((person) => person.id);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              if (personIds.length > 0) {
                yield* tx
                  .delete(personUnlockedPerks)
                  .where(
                    and(
                      inArray(personUnlockedPerks.personId, personIds),
                      eq(personUnlockedPerks.environment, ProviderEnvironment.Development),
                    ),
                  );
              }
              if (mappingIds.length > 0) {
                yield* tx
                  .delete(transactions)
                  .where(
                    and(
                      inArray(transactions.paymentProviderConfigurationProductId, mappingIds),
                      eq(transactions.providerEnvironment, ProviderEnvironment.Development),
                    ),
                  );
                yield* tx
                  .delete(purchases)
                  .where(
                    and(
                      inArray(purchases.paymentProviderConfigurationProductId, mappingIds),
                      eq(purchases.providerEnvironment, ProviderEnvironment.Development),
                    ),
                  );
                yield* tx
                  .delete(subscriptions)
                  .where(
                    and(
                      inArray(subscriptions.paymentProviderConfigurationProductId, mappingIds),
                      eq(subscriptions.providerEnvironment, ProviderEnvironment.Development),
                    ),
                  );
              }
              yield* tx
                .delete(purchaseLedger)
                .where(
                  and(
                    eq(purchaseLedger.projectId, projectId),
                    eq(purchaseLedger.providerId, "development"),
                  ),
                );
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new DevelopmentPaymentProviderServiceError({ message: String(error.cause) }),
                ),
            }),
          ),
      );

      return {
        applyLifecycleAction,
        getDevelopmentSettings,
        getDevelopmentState,
        processSdkPurchase,
        resetDevelopmentData,
        setDevelopmentPurchasesEnabled,
      };
    }),
  },
) {
  static layer = Layer.effect(DevelopmentPaymentProviderService)(
    DevelopmentPaymentProviderService.make,
  );
}
