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
	status: string,
): "none" | "active" | "canceled" | "past_due" | "trialing" {
	switch (status) {
		case "active":
			return "active";
		case "canceled":
		case "revoked":
			return "canceled";
		case "incomplete":
		case "incomplete_expired":
		case "past_due":
		case "unpaid":
			return "past_due";
		case "trialing":
			return "trialing";
		default:
			return "none";
	}
}

const _getMeter = (db: Db) =>
	db.makeQuery((execute, input: { metricId: MetricIdValue }) =>
		execute(async (db) => {
			return db.query.billingProviderMeters.findFirst({
				where: and(
					eq(billingProviderMeters.metricId, input.metricId),
					eq(billingProviderMeters.providerId, PROVIDER_ID),
				),
			});
		}),
	);

/**
 * Polar.sh billing provider implementation
 */
export const makePolarBillingProvider = Effect.gen(function* () {
	const config = yield* PolarConfigService;
	const db = yield* Db;

	const client = new Polar({
		accessToken: config.accessToken,
		server: config.sandbox ? "sandbox" : "production",
	});

	const service: BillingProviderService = {
		config: {
			id: PROVIDER_ID,
			name: "Polar.sh",
		},

		syncCustomer: (organizationId: string, email: string) =>
			Effect.gen(function* () {
				// Check if customer exists by external ID (organizationId)
				const existing = yield* Effect.tryPromise({
					try: async () => {
						const customers = await client.customers.list({
							organizationId: config.organizationId,
							query: organizationId, // Search by external ID
						});
						return customers.result.items.find(
							(c) => c.externalId === organizationId,
						);
					},
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to list customers",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				if (existing) {
					// Get subscription status
					const subscriptions = yield* Effect.tryPromise({
						try: async () =>
							client.subscriptions.list({
								organizationId: config.organizationId,
								customerId: existing.id,
							}),
						catch: (e) =>
							new BillingProviderError({
								message: "Failed to get subscriptions",
								provider: PROVIDER_ID,
								cause: String(e),
							}),
					});

					const activeSubscription = subscriptions.result.items.find(
						(s) => s.status === "active",
					);

					// Determine tier from subscription
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
						organizationId,
						externalCustomerId: existing.id,
						tier,
						subscriptionStatus: activeSubscription
							? mapPolarSubscriptionStatus(activeSubscription.status)
							: "none",
					};
				}

				// Create new customer
				const newCustomer = yield* Effect.tryPromise({
					try: async () =>
						client.customers.create({
							organizationId: config.organizationId,
							externalId: organizationId,
							email: email ?? undefined,
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to create customer",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				return {
					organizationId,
					externalCustomerId: newCustomer.id,
					tier: BillingTierName.Free,
					subscriptionStatus: "none" as const,
				};
			}),

		getCustomer: (organizationId: string) =>
			Effect.gen(function* () {
				const customers = yield* Effect.tryPromise({
					try: async () =>
						client.customers.list({
							organizationId: config.organizationId,
							query: organizationId,
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to get customer",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				const customer = customers.result.items.find(
					(c) => c.externalId === organizationId,
				);

				if (!customer) {
					return null;
				}

				// Get subscriptions to determine tier
				const subscriptions = yield* Effect.tryPromise({
					try: async () =>
						client.subscriptions.list({
							organizationId: config.organizationId,
							customerId: customer.id,
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to get subscriptions",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				const activeSubscription = subscriptions.result.items.find(
					(s) => s.status === "active",
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
					organizationId,
					externalCustomerId: customer.id,
					tier,
					subscriptionStatus: activeSubscription
						? mapPolarSubscriptionStatus(activeSubscription.status)
						: "none",
				} as CustomerInfo;
			}),

		recordUsageToProvider: (
			record: UsageRecordInput & { externalCustomerId: string },
		) =>
			Effect.gen(function* () {
				// Polar uses meters for usage tracking
				// We need to record events to the appropriate meter
				yield* Effect.tryPromise({
					try: async () => {
						// Use the Polar events API to record usage
						// This is a simplified implementation - actual implementation
						// would need to map metricId to Polar meter ID
						await client.events.ingest({
							events: [
								{
									name: record.metricId,
									externalCustomerId: record.externalCustomerId,
									metadata: {
										value: record.value,
										...(record.metadata ?? {}),
									},
								},
							],
						});
					},
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to record usage to provider",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});
			}),

		getUsageFromProvider: (
			externalCustomerId: string,
			metricId: MetricIdValue,
			periodStart: Date,
			periodEnd: Date,
		) =>
			Effect.gen(function* () {
				// Polar customer meters API
				// This is a simplified implementation
				const meter = yield* _getMeter(db)({ metricId });
				if (!meter) {
					return yield* Effect.fail(
						new BillingProviderError({
							message: "Meter not found",
							provider: PROVIDER_ID,
							cause: "Meter not found",
						}),
					);
				}
				const usage = yield* Effect.tryPromise({
					try: async () =>
						client.meters.quantities({
							id: meter.externalMeterId,
							customerId: externalCustomerId,
							startTimestamp: periodStart,
							endTimestamp: periodEnd,
							interval: "day",
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to get usage from provider",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				return usage.quantities.reduce((acc, curr) => acc + curr.quantity, 0);
			}).pipe(
				Effect.catchTags({
					DatabaseError: (error) =>
						new BillingProviderError({
							message: "Failed to get usage from provider",
							provider: PROVIDER_ID,
							cause: String(error.cause),
						}),
				}),
			),

		createCheckoutSession: (input: CreateCheckoutInput) =>
			Effect.gen(function* () {
				const productId =
					input.tier === BillingTierName.Enterprise
						? config.tierProductIds.enterprise
						: config.tierProductIds.pro;

				const checkout = yield* Effect.tryPromise({
					try: async () =>
						client.checkouts.create({
							productId,
							customerId: input.externalCustomerId,
							successUrl: input.successUrl,
							customerExternalId: input.organizationId,
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to create checkout session",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				return {
					id: checkout.id,
					url: checkout.url,
				} as CheckoutSessionResult;
			}),

		getSubscription: (externalCustomerId: string) =>
			Effect.gen(function* () {
				const subscriptions = yield* Effect.tryPromise({
					try: async () =>
						client.subscriptions.list({
							organizationId: config.organizationId,
							customerId: externalCustomerId,
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to get subscription",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});

				const activeSubscription = subscriptions.result.items.find(
					(s) => s.status === "active" || s.status === "trialing",
				);

				if (!activeSubscription) {
					return null;
				}

				// Determine tier from product ID
				let tier: BillingTierNameValue = BillingTierName.Free;
				if (activeSubscription.productId === config.tierProductIds.enterprise) {
					tier = BillingTierName.Enterprise;
				} else if (activeSubscription.productId === config.tierProductIds.pro) {
					tier = BillingTierName.Pro;
				}

				return {
					externalSubscriptionId: activeSubscription.id,
					status: mapPolarSubscriptionStatus(activeSubscription.status),
					currentPeriodStart: new Date(activeSubscription.currentPeriodStart),
					currentPeriodEnd: activeSubscription.currentPeriodEnd
						? new Date(activeSubscription.currentPeriodEnd)
						: null,
					tier,
				} as SubscriptionInfo;
			}),

		cancelSubscription: (externalSubscriptionId: string) =>
			Effect.gen(function* () {
				yield* Effect.tryPromise({
					try: async () =>
						client.subscriptions.update({
							id: externalSubscriptionId,
							subscriptionUpdate: {
								cancelAtPeriodEnd: true,
							},
						}),
					catch: (e) =>
						new BillingProviderError({
							message: "Failed to cancel subscription",
							provider: PROVIDER_ID,
							cause: String(e),
						}),
				});
			}),

		syncMeters: () =>
			Effect.gen(function* () {
				// List existing meters and create any that are missing
				// For now, we assume meters are created manually in Polar dashboard
				yield* Effect.log(
					"Polar meters should be configured in the Polar dashboard",
				);
			}),

		getProductIdForTier: (tier: BillingTierNameValue) =>
			Effect.succeed(
				tier === BillingTierName.Enterprise
					? config.tierProductIds.enterprise
					: tier === BillingTierName.Pro
						? config.tierProductIds.pro
						: null,
			),
	};

	return service;
});

/**
 * Layer that provides BillingProvider using Polar implementation
 */
export const PolarBillingProviderLive = Layer.effect(
	BillingProvider,
	makePolarBillingProvider,
);
