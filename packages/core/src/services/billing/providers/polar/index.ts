import { Polar } from "@polar-sh/sdk";
import { and, billingProviderMeters, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect, Layer } from "effect";

import { BillingProviderError } from "../../../../billing/errors";
import type {
  BillingTierNameValue,
  CheckoutSessionResult,
  CreateCheckoutInput,
  CustomerInfo,
  MetricIdValue,
  SubscriptionInfo,
  UsageRecordInput,
} from "../../../../billing/types";
import { BillingTierName } from "../../../../billing/types";
import {
  BillingProvider,
  type BillingProviderService,
} from "../billing-provider";
import { PolarConfigService } from "./config";

export { type PolarConfig, PolarConfigService } from "./config";
export { handlePolarWebhook } from "./webhooks";

const PROVIDER_ID = "polar";

/**
 * Map Polar subscription status to our status
 */
function mapPolarSubscriptionStatus(
  status: string
): "none" | "active" | "canceled" | "past_due" | "trialing" {
  switch (status) {
    case "active": {
      return "active";
    }
    case "canceled":
    case "revoked": {
      return "canceled";
    }
    case "incomplete":
    case "incomplete_expired":
    case "past_due":
    case "unpaid": {
      return "past_due";
    }
    case "trialing": {
      return "trialing";
    }
    default: {
      return "none";
    }
  }
}

const _getMeter = (db: Db) =>
  db.makeQuery((execute, input: { metricId: MetricIdValue }) =>
    execute(async (db) =>
      db.query.billingProviderMeters.findFirst({
        where: and(
          eq(billingProviderMeters.metricId, input.metricId),
          eq(billingProviderMeters.providerId, PROVIDER_ID)
        ),
      })
    )
  );

/**
 * Polar.sh billing provider implementation
 */
export const makePolarBillingProvider = Effect.gen(
  function* makePolarBillingProvider() {
    const config = yield* PolarConfigService;
    const db = yield* Db;

    const client = new Polar({
      accessToken: config.accessToken,
      server: config.sandbox ? "sandbox" : "production",
    });

    const service: BillingProviderService = {
      cancelSubscription: (externalSubscriptionId: string) =>
        Effect.gen(function* cancelSubscription() {
          yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to cancel subscription",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.subscriptions.update({
                id: externalSubscriptionId,
                subscriptionUpdate: {
                  cancelAtPeriodEnd: true,
                },
              }),
          });
        }),

      config: {
        id: PROVIDER_ID,
        name: "Polar.sh",
      },

      createCheckoutSession: (input: CreateCheckoutInput) =>
        Effect.gen(function* createCheckoutSession() {
          const productId =
            input.tier === BillingTierName.Enterprise
              ? config.tierProductIds.enterprise
              : config.tierProductIds.pro;

          const checkout = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to create checkout session",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.checkouts.create({
                customerExternalId: input.organizationId,
                customerId: input.externalCustomerId,
                productId,
                successUrl: input.successUrl,
              }),
          });

          return {
            id: checkout.id,
            url: checkout.url,
          } as CheckoutSessionResult;
        }),

      getCustomer: (organizationId: string) =>
        Effect.gen(function* getCustomer() {
          const customers = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to get customer",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.customers.list({
                organizationId: config.organizationId,
                query: organizationId,
              }),
          });

          const customer = customers.result.items.find(
            (c) => c.externalId === organizationId
          );

          if (!customer) {
            return null;
          }

          // Get subscriptions to determine tier
          const subscriptions = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to get subscriptions",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.subscriptions.list({
                customerId: customer.id,
                organizationId: config.organizationId,
              }),
          });

          const activeSubscription = subscriptions.result.items.find(
            (s) => s.status === "active"
          );

          let tier: BillingTierNameValue = BillingTierName.Free;
          if (activeSubscription) {
            if (
              activeSubscription.productId === config.tierProductIds.enterprise
            ) {
              tier = BillingTierName.Enterprise;
            } else if (
              activeSubscription.productId === config.tierProductIds.pro
            ) {
              tier = BillingTierName.Pro;
            }
          }

          return {
            externalCustomerId: customer.id,
            organizationId,
            subscriptionStatus: activeSubscription
              ? mapPolarSubscriptionStatus(activeSubscription.status)
              : "none",
            tier,
          } as CustomerInfo;
        }),

      getProductIdForTier: (tier: BillingTierNameValue) =>
        Effect.succeed(
          tier === BillingTierName.Enterprise
            ? config.tierProductIds.enterprise
            : (tier === BillingTierName.Pro
              ? config.tierProductIds.pro
              : null)
        ),

      getSubscription: (externalCustomerId: string) =>
        Effect.gen(function* getSubscription() {
          const subscriptions = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to get subscription",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.subscriptions.list({
                customerId: externalCustomerId,
                organizationId: config.organizationId,
              }),
          });

          const activeSubscription = subscriptions.result.items.find(
            (s) => s.status === "active" || s.status === "trialing"
          );

          if (!activeSubscription) {
            return null;
          }

          // Determine tier from product ID
          let tier: BillingTierNameValue = BillingTierName.Free;
          if (
            activeSubscription.productId === config.tierProductIds.enterprise
          ) {
            tier = BillingTierName.Enterprise;
          } else if (
            activeSubscription.productId === config.tierProductIds.pro
          ) {
            tier = BillingTierName.Pro;
          }

          return {
            currentPeriodEnd: activeSubscription.currentPeriodEnd
              ? new Date(activeSubscription.currentPeriodEnd)
              : null,
            currentPeriodStart: new Date(activeSubscription.currentPeriodStart),
            externalSubscriptionId: activeSubscription.id,
            status: mapPolarSubscriptionStatus(activeSubscription.status),
            tier,
          } as SubscriptionInfo;
        }),

      getUsageFromProvider: (
        externalCustomerId: string,
        metricId: MetricIdValue,
        periodStart: Date,
        periodEnd: Date
      ) =>
        Effect.gen(function* getUsageFromProvider() {
          // Polar customer meters API
          // This is a simplified implementation
          const meter = yield* _getMeter(db)({ metricId });
          if (!meter) {
            return yield* Effect.fail(
              new BillingProviderError({
                cause: "Meter not found",
                message: "Meter not found",
                provider: PROVIDER_ID,
              })
            );
          }
          const usage = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to get usage from provider",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.meters.quantities({
                customerId: externalCustomerId,
                endTimestamp: periodEnd,
                id: meter.externalMeterId,
                interval: "day",
                startTimestamp: periodStart,
              }),
          });

          return usage.quantities.reduce((acc, curr) => acc + curr.quantity, 0);
        }).pipe(
          Effect.catchTags({
            DatabaseError: (error) =>
              new BillingProviderError({
                cause: String(error.cause),
                message: "Failed to get usage from provider",
                provider: PROVIDER_ID,
              }),
          })
        ),

      recordUsageToProvider: (
        record: UsageRecordInput & { externalCustomerId: string }
      ) =>
        Effect.gen(function* recordUsageToProvider() {
          // Polar uses meters for usage tracking
          // We need to record events to the appropriate meter
          yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to record usage to provider",
                provider: PROVIDER_ID,
              }),
            try: async () => {
              // Use the Polar events API to record usage
              // This is a simplified implementation - actual implementation
              // would need to map metricId to Polar meter ID
              await client.events.ingest({
                events: [
                  {
                    externalCustomerId: record.externalCustomerId,
                    metadata: {
                      value: record.value,
                      ...record.metadata,
                    },
                    name: record.metricId,
                  },
                ],
              });
            },
          });
        }),

      syncCustomer: (organizationId: string, email: string) =>
        Effect.gen(function* syncCustomer() {
          // Check if customer exists by external ID (organizationId)
          const existing = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to list customers",
                provider: PROVIDER_ID,
              }),
            try: async () => {
              const customers = await client.customers.list({
                organizationId: config.organizationId,
                query: organizationId, // Search by external ID
              });
              return customers.result.items.find(
                (c) => c.externalId === organizationId
              );
            },
          });

          if (existing) {
            // Get subscription status
            const subscriptions = yield* Effect.tryPromise({
              catch: (e) =>
                new BillingProviderError({
                  cause: String(e),
                  message: "Failed to get subscriptions",
                  provider: PROVIDER_ID,
                }),
              try: async () =>
                client.subscriptions.list({
                  customerId: existing.id,
                  organizationId: config.organizationId,
                }),
            });

            const activeSubscription = subscriptions.result.items.find(
              (s) => s.status === "active"
            );

            // Determine tier from subscription
            let tier: BillingTierNameValue = BillingTierName.Free;
            if (activeSubscription) {
              if (
                activeSubscription.productId ===
                config.tierProductIds.enterprise
              ) {
                tier = BillingTierName.Enterprise;
              } else if (
                activeSubscription.productId === config.tierProductIds.pro
              ) {
                tier = BillingTierName.Pro;
              }
            }

            return {
              externalCustomerId: existing.id,
              organizationId,
              subscriptionStatus: activeSubscription
                ? mapPolarSubscriptionStatus(activeSubscription.status)
                : "none",
              tier,
            };
          }

          // Create new customer
          const newCustomer = yield* Effect.tryPromise({
            catch: (e) =>
              new BillingProviderError({
                cause: String(e),
                message: "Failed to create customer",
                provider: PROVIDER_ID,
              }),
            try: async () =>
              client.customers.create({
                email: email ?? undefined,
                externalId: organizationId,
                organizationId: config.organizationId,
              }),
          });

          return {
            externalCustomerId: newCustomer.id,
            organizationId,
            subscriptionStatus: "none" as const,
            tier: BillingTierName.Free,
          };
        }),

      syncMeters: () =>
        Effect.gen(function* syncMeters() {
          // List existing meters and create any that are missing
          // For now, we assume meters are created manually in Polar dashboard
          yield* Effect.log(
            "Polar meters should be configured in the Polar dashboard"
          );
        }),
    };

    return service;
  }
);

/**
 * Layer that provides BillingProvider using Polar implementation
 */
export const PolarBillingProviderLive = Layer.effect(
  BillingProvider,
  makePolarBillingProvider
);
