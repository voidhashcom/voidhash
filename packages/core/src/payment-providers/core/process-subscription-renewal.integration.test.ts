// import { generateId } from "@/lib/id/generate";
// import { devCheckout } from "@/lib/payment-providers/dev-checkout/dev-checkout";
// import { createTestServiceContext } from "@/lib/testing/create-test-service-context";
// import { IntegrationHarness } from "@/lib/testing/integration-harness";
// import {
// 	and,
// 	transactions,
// 	customers,
// 	eq,
// 	InsertCustomer,
// 	InsertProduct,
// 	InsertPaymentProviderConfigurationProduct,
// 	paymentProviderConfigurationProducts,
// 	products,
// 	purchases,
// 	subscriptions,
// 	customerUnlockedPerks,
// 	InsertProductPerk,
// 	productPerks,
// } from "@voidhash/db";
// import { describe, expect, it, test } from "vitest";
// import { processSubscriptionRenewal } from "./process-subscription-renewal";
// import { processSubscriptionCreation } from "./process-subscription-creation";

// const setupResources = async (h: IntegrationHarness) => {
// 	// Prepare resources
// 	const productInsert = {
// 		id: generateId("test"),
// 		projectId: h.resources.project.id,
// 		name: "Test Product",
// 		type: "subscription",
// 		environment: "production",
// 		createdAt: new Date(),
// 		updatedAt: new Date(),
// 	} satisfies InsertProduct;

// 	await h.db.primary.insert(products).values(productInsert);

// 	const paymentProviderConfigurationProductInsert = {
// 		id: generateId("test"),
// 		productId: productInsert.id,
// 		paymentProviderConfigurationId: h.resources.paymentProviderConfiguration.id,
// 		providerProductKey: devCheckout.createProductKey({
// 			productId: productInsert.id,
// 		}),
// 		configuration: {
// 			productId: productInsert.id,
// 		},
// 	} satisfies InsertPaymentProviderConfigurationProduct;

// 	await h.db.primary
// 		.insert(paymentProviderConfigurationProducts)
// 		.values(paymentProviderConfigurationProductInsert);

// 	const customerInsert = {
// 		id: generateId("test"),
// 		projectId: h.resources.project.id,
// 		appUserId: generateId("test"),
// 		email: "test@example.com",
// 		name: "Test Customer",
// 		origin: "ios",
// 		environment: "production",
// 		createdAt: new Date(),
// 		updatedAt: new Date(),
// 	} satisfies InsertCustomer;

// 	await h.db.primary.insert(customers).values(customerInsert);

// 	const paymentProviderConfigurationProduct =
// 		await h.db.primary.query.paymentProviderConfigurationProducts.findFirst({
// 			where: and(
// 				eq(
// 					paymentProviderConfigurationProducts.id,
// 					paymentProviderConfigurationProductInsert.id
// 				)
// 			),
// 			with: {
// 				product: true,
// 			},
// 		});

// 	if (!paymentProviderConfigurationProduct) {
// 		throw new Error("Payment provider configuration product not found");
// 	}

// 	const productPerkInsert = {
// 		id: generateId("test"),
// 		productId: productInsert.id,
// 		perkId: productInsert.id,
// 	} satisfies InsertProductPerk;

// 	await h.db.primary.insert(productPerks).values(productPerkInsert);

// 	return {
// 		customerInsert,
// 		paymentProviderConfigurationProduct,
// 		productInsert,
// 		productPerkInsert,
// 	};
// };

// describe.sequential("process-subscription-creation", async () => {
// 	test("process subscription creation successfully", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const {
// 			customerInsert,
// 			paymentProviderConfigurationProduct,
// 			productInsert,
// 		} = await setupResources(h);

// 		const ctx = await createTestServiceContext();
// 		const purchseKey = generateId("test");

// 		// Create subscription
// 		const processSubscriptionPurchaseResult = await processSubscriptionCreation(
// 			ctx,
// 			paymentProviderConfigurationProduct,
// 			{
// 				customerId: customerInsert.id,
// 				purchasedAt: new Date(),
// 				startsAt: new Date(),
// 				canceledAt: null,
// 				cancelAtPeriodEnd: false,
// 				expiresAt: new Date(),
// 				storeSubscriptionId: purchseKey,
// 				isTrial: false,
// 				providerEnvironment: "production",
// 				transaction: {
// 					amount: 1000,
// 					currency: "USD",
// 					storeTransactionId: generateId("test"),
// 				},
// 			}
// 		);

// 		if (processSubscriptionPurchaseResult.isErr()) {
// 			throw processSubscriptionPurchaseResult.error;
// 		}

// 		// Process subscription creation
// 		const renewedAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
// 		const expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30);
// 		const processSubscriptionRenewalResult = await processSubscriptionRenewal(
// 			ctx,
// 			{
// 				subscriptionId: processSubscriptionPurchaseResult.value.id,
// 				renewedAt: renewedAt,
// 				expiresAt: expiresAt,
// 				transaction: {
// 					amount: 2000,
// 					currency: "USD",
// 					storeTransactionId: generateId("test"),
// 				},
// 			}
// 		);

// 		if (processSubscriptionRenewalResult.isErr()) {
// 			throw processSubscriptionRenewalResult.error;
// 		}

// 		// Verify resources
// 		const subscription = await h.db.primary.query.subscriptions.findFirst({
// 			where: and(
// 				eq(subscriptions.storeSubscriptionId, purchseKey),
// 				eq(subscriptions.customerId, customerInsert.id)
// 			),
// 		});

// 		const charges = await h.db.primary.query.transactions.findMany({
// 			where: and(
// 				eq(transactions.customerId, customerInsert.id),
// 				eq(
// 					transactions.paymentProviderConfigurationProductId,
// 					paymentProviderConfigurationProduct.id
// 				),
// 				eq(transactions.providerEnvironment, "production")
// 			),
// 		});

// 		const updatedSubscription =
// 			await h.db.primary.query.subscriptions.findFirst({
// 				where: and(eq(subscriptions.id, subscription!.id)),
// 			});

// 		expect(updatedSubscription).toBeDefined();
// 		expect(
// 			Math.round((updatedSubscription?.expiresAt?.getTime() ?? 0) / 1000) * 1000
// 		).toBe(Math.round((expiresAt.getTime() ?? 0) / 1000) * 1000);
// 		expect(updatedSubscription?.status).toBe("active");
// 		expect(updatedSubscription?.latestTransactionId).not.toBe(
// 			updatedSubscription!.initialTransactionId
// 		);

// 		const latestTransaction = charges.find(
// 			(charge) => charge.id === updatedSubscription!.latestTransactionId
// 		);

// 		expect(latestTransaction).toBeDefined();
// 		expect(latestTransaction?.amount).toBe(2000);
// 		expect(latestTransaction?.currency).toBe("USD");
// 		expect(latestTransaction?.paymentProviderConfigurationProductId).toBe(
// 			paymentProviderConfigurationProduct.id
// 		);
// 		expect(latestTransaction?.providerEnvironment).toBe("production");
// 		expect(latestTransaction?.customerId).toBe(customerInsert.id);

// 		// Verify perks
// 		const customerUnlockedPerks =
// 			await h.db.primary.query.customerUnlockedPerks.findMany({
// 				where: and(
// 					eq(customerUnlockedPerks.customerId, customerInsert.id),
// 					eq(customerUnlockedPerks.unlockedBySubscriptionId, subscription!.id)
// 				),
// 			});

// 		expect(customerUnlockedPerks).toBeDefined();
// 		expect(customerUnlockedPerks.length).toBe(1);
// 		expect(customerUnlockedPerks[0]!.customerId).toBe(customerInsert.id);
// 		expect(customerUnlockedPerks[0]!.unlockedBySubscriptionId).toBe(
// 			subscription!.id
// 		);
// 		expect(customerUnlockedPerks[0]!.expiresAt).toBeDefined();
// 		expect(
// 			Math.round((customerUnlockedPerks[0]!.expiresAt?.getTime() ?? 0) / 1000) *
// 				1000
// 		).toBe(Math.round((expiresAt.getTime() ?? 0) / 1000) * 1000);
// 		expect(customerUnlockedPerks[0]!.perkId).toBe(productInsert.id);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(customers)
// 				.where(eq(customers.id, customerInsert.id));
// 			await h.db.primary
// 				.delete(products)
// 				.where(eq(products.id, productInsert.id));
// 			await h.db.primary
// 				.delete(paymentProviderConfigurationProducts)
// 				.where(
// 					eq(paymentProviderConfigurationProducts.productId, productInsert.id)
// 				);
// 			await h.db.primary
// 				.delete(purchases)
// 				.where(eq(purchases.customerId, customerInsert.id));
// 		});
// 	});
// });
