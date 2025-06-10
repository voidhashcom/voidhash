import { generateId } from "@/lib/id/generate";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	checkoutSessions,
	customers,
	eq,
	InsertCheckoutSession,
	InsertCustomer,
	InsertProduct,
	InsertProductProviderConfiguration,
	productProviderConfigurations,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { devCheckout } from "./dev-checkout";
import { createDevCheckoutPaymentProviderServer } from "./dev-checout-server";
import { createTestServiceContext } from "@/lib/testing/create-test-service-context";

describe.sequential("dev-checkout-server", async () => {
	test("should confirm purchase - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		const productInsert = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			name: "Test Product",
			type: "subscription",
			environment: "production",
			createdAt: new Date(),
			updatedAt: new Date(),
		} satisfies InsertProduct;

		await h.db.primary.insert(products).values(productInsert);

		const productProviderConfigurationInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			providerConfigurationId:
				h.resources.projectPaymentProviderConfiguration.id,
			providerProductKey: devCheckout.createProductKey({
				productId: productInsert.id,
			}),
			configuration: {
				productId: productInsert.id,
			},
		} satisfies InsertProductProviderConfiguration;

		await h.db.primary
			.insert(productProviderConfigurations)
			.values(productProviderConfigurationInsert);

		const customerInsert = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: generateId("test"),
			email: "test@example.com",
			name: "Test Customer",
			origin: "ios",
			environment: "production",
			createdAt: new Date(),
			updatedAt: new Date(),
		} satisfies InsertCustomer;

		await h.db.primary.insert(customers).values(customerInsert);

		const sessionInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			customerId: customerInsert.id,
			status: "pending",
			successCallbackUrl: "testapp://voidhash/callback/success",
			errorCallbackUrl: "testapp://voidhash/callback/error",
			paymentProviderConfigurationId:
				h.resources.projectPaymentProviderConfiguration.id,
		} satisfies InsertCheckoutSession;

		await h.db.primary.insert(checkoutSessions).values(sessionInsert);

		const devCheckoutServer = createDevCheckoutPaymentProviderServer();

		const ctx = await createTestServiceContext();
		const result = await devCheckoutServer.confirmPurchase(ctx, {
			checkoutSessionId: sessionInsert.id,
		});

		console.log(result);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().redirectUrl).toBe(
			sessionInsert.successCallbackUrl
		);

		const checkoutSession = await h.db.primary.query.checkoutSessions.findFirst(
			{
				where: eq(checkoutSessions.id, sessionInsert.id),
			}
		);

		expect(checkoutSession).toBeDefined();
		expect(checkoutSession?.status).toBe("success");

		t.onTestFinished(async () => {
			await h.db.primary
				.delete(checkoutSessions)
				.where(eq(checkoutSessions.id, sessionInsert.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, customerInsert.id));
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInsert.id));
			await h.db.primary
				.delete(productProviderConfigurations)
				.where(eq(productProviderConfigurations.productId, productInsert.id));
		});
	});

	test("should cancel a checkout session - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		const productInsert = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			name: "Test Product",
			type: "subscription",
			environment: "production",
			createdAt: new Date(),
			updatedAt: new Date(),
		} satisfies InsertProduct;

		await h.db.primary.insert(products).values(productInsert);

		const productProviderConfigurationInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			providerConfigurationId:
				h.resources.projectPaymentProviderConfiguration.id,
			providerProductKey: devCheckout.createProductKey({
				productId: productInsert.id,
			}),
		} satisfies InsertProductProviderConfiguration;

		await h.db.primary
			.insert(productProviderConfigurations)
			.values(productProviderConfigurationInsert);

		const customerInsert = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: generateId("test"),
			email: "test@example.com",
			name: "Test Customer",
			origin: "ios",
			environment: "production",
			createdAt: new Date(),
			updatedAt: new Date(),
		} satisfies InsertCustomer;

		await h.db.primary.insert(customers).values(customerInsert);

		const sessionInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			customerId: customerInsert.id,
			status: "pending",
			successCallbackUrl: "testapp://voidhash/callback/success",
			errorCallbackUrl: "testapp://voidhash/callback/error",
			paymentProviderConfigurationId:
				h.resources.projectPaymentProviderConfiguration.id,
		} satisfies InsertCheckoutSession;

		await h.db.primary.insert(checkoutSessions).values(sessionInsert);

		const devCheckoutServer = createDevCheckoutPaymentProviderServer();

		const ctx = await createTestServiceContext();
		const result = await devCheckoutServer.cancelPurchase(ctx, {
			checkoutSessionId: sessionInsert.id,
		});

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().redirectUrl).toBe(
			sessionInsert.errorCallbackUrl
		);

		t.onTestFinished(async () => {
			await h.db.primary
				.delete(checkoutSessions)
				.where(eq(checkoutSessions.id, sessionInsert.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, customerInsert.id));
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInsert.id));
			await h.db.primary
				.delete(productProviderConfigurations)
				.where(eq(productProviderConfigurations.productId, productInsert.id));
		});
	});
});
