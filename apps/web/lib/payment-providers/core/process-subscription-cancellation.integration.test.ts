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
// 	customersUnlockedPerks,
// 	InsertProductPerk,
// 	productPerks,
// } from "@voidhash/db";
// import { describe, expect, test } from "vitest";
// import { processSubscriptionCreation } from "./process-subscription-creation";

// describe.sequential("process-subscription-refund", async () => {
// 	test("process subscription refund successfully", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const ctx = await createTestServiceContext();

// 		// Prepare resources
// 		const productInsert = {
// 			id: generateId("test"),
// 			projectId: h.resources.project.id,
// 			name: "Test Product",
// 			type: "subscription",
// 			environment: "production",
// 			createdAt: new Date(),
// 			updatedAt: new Date(),
// 		} satisfies InsertProduct;

// 		await h.db.primary.insert(products).values(productInsert);

// 		const paymentProviderConfigurationProductInsert = {
// 			id: generateId("test"),
// 			productId: productInsert.id,
// 			paymentProviderConfigurationId:
// 				h.resources.paymentProviderConfiguration.id,
// 			providerProductKey: devCheckout.createProductKey({
// 				productId: productInsert.id,
// 			}),
// 			configuration: {
// 				productId: productInsert.id,
// 			},
// 		} satisfies InsertPaymentProviderConfigurationProduct;

// 		await h.db.primary
// 			.insert(paymentProviderConfigurationProducts)
// 			.values(paymentProviderConfigurationProductInsert);

// 		const customerInsert = {
// 			id: generateId("test"),
// 			projectId: h.resources.project.id,
// 			appUserId: generateId("test"),
// 			email: "test@example.com",
// 			name: "Test Customer",
// 			origin: "ios",
// 			environment: "production",
// 			createdAt: new Date(),
// 			updatedAt: new Date(),
// 		} satisfies InsertCustomer;

// 		await h.db.primary.insert(customers).values(customerInsert);

// 		const paymentProviderConfigurationProduct =
// 			await h.db.primary.query.paymentProviderConfigurationProducts.findFirst({
// 				where: and(
// 					eq(
// 						paymentProviderConfigurationProducts.id,
// 						paymentProviderConfigurationProductInsert.id
// 					)
// 				),
// 				with: {
// 					product: true,
// 				},
// 			});

// 		if (!paymentProviderConfigurationProduct) {
// 			throw new Error("Payment provider configuration product not found");
// 		}

// 		const productPerkInsert = {
// 			id: generateId("test"),
// 			productId: productInsert.id,
// 			perkId: productInsert.id,
// 		} satisfies InsertProductPerk;

// 		await h.db.primary.insert(productPerks).values(productPerkInsert);

// 		const purchseKey = generateId("test");

// 		// Process subscription creation
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
// 				},
// 			}
// 		);

// 		if (processSubscriptionPurchaseResult.isErr()) {
// 			throw processSubscriptionPurchaseResult.error;
// 		}

// 		// Verify resources
// 		const subscription = await h.db.primary.query.subscriptions.findFirst({
// 			where: and(
// 				eq(subscriptions.storeSubscriptionId, purchseKey),
// 				eq(subscriptions.customerId, customerInsert.id)
// 			),
// 		});

// 		const charge = await h.db.primary.query.transactions.findFirst({
// 			where: and(
// 				eq(transactions.customerId, customerInsert.id),
// 				eq(
// 					transactions.paymentProviderConfigurationProductId,
// 					paymentProviderConfigurationProduct.id
// 				),
// 				eq(transactions.providerEnvironment, "production")
// 			),
// 		});

// 		// Should create a subscription
// 		expect(subscription).toBeDefined();
// 		expect(subscription?.customerId).toBe(customerInsert.id);
// 		expect(subscription?.paymentProviderConfigurationProductId).toBe(
// 			paymentProviderConfigurationProduct.id
// 		);
// 		expect(subscription?.providerEnvironment).toBe("production");
// 		expect(subscription?.storeSubscriptionId).toBe(purchseKey);
// 		expect(subscription?.startsAt).toBeDefined();

// 		// Should create a charge
// 		expect(charge).toBeDefined();
// 		expect(charge?.amount).toBe(1000);
// 		expect(charge?.currency).toBe("USD");
// 		expect(charge?.paymentProviderConfigurationProductId).toBe(
// 			paymentProviderConfigurationProduct.id
// 		);
// 		expect(charge?.providerEnvironment).toBe("production");
// 		expect(charge?.customerId).toBe(customerInsert.id);

// 		// Verify perks
// 		const customerUnlockedPerks =
// 			await h.db.primary.query.customersUnlockedPerks.findMany({
// 				where: and(
// 					eq(customersUnlockedPerks.customerId, customerInsert.id),
// 					eq(customersUnlockedPerks.unlockedBySubscriptionId, subscription!.id)
// 				),
// 			});

// 		// Should unlock perks
// 		expect(customerUnlockedPerks).toBeDefined();
// 		expect(customerUnlockedPerks.length).toBe(1);
// 		expect(customerUnlockedPerks[0]!.customerId).toBe(customerInsert.id);
// 		expect(customerUnlockedPerks[0]!.unlockedBySubscriptionId).toBe(
// 			subscription!.id
// 		);
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
