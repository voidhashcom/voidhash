import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	purchases,
	customersUnlockedPerks,
	customers,
	Product,
	ProductProviderConfiguration,
	Perk,
	ProductPerk,
	products,
	productProviderConfigurations,
	perks,
	productPerks,
} from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { handleProductPurchase, PurchaseEvent } from "./on-product-purchased";
import { VoidhashError } from "@voidhash/lib";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { eq, and } from "drizzle-orm";
import { createTestServiceContext } from "@/lib/testing/create-test-service-context";

describe.sequential("on-product-purchased integration tests", () => {
	const productId = generateId("test");
	const productProviderConfigurationId = generateId("test");
	const perkId = generateId("test");
	const productPerkId = generateId("test");

	beforeEach(async (t) => {
		const h = await IntegrationHarness.init(t);

		const product: Product = {
			id: productId,
			name: "Test Product",
			type: "subscription",
			createdAt: new Date(),
			updatedAt: new Date(),
			projectId: h.resources.project.id,
		};

		const productProviderConfiguration: ProductProviderConfiguration = {
			id: productProviderConfigurationId,
			productId: productId,
			isActive: true,
			providerId: "stripe",
			providerProductKey: "test-product-id",
			configuration: {
				productId: "prod_1234567890",
				priceId: "price_1234567890",
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const perk: Perk = {
			id: perkId,
			name: "Test Perk",
			slug: "test-perk",
			projectId: h.resources.project.id,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const productPerk: ProductPerk = {
			id: productPerkId,
			productId: productId,
			perkId: perkId,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await h.db.primary.insert(products).values(product);
		await h.db.primary
			.insert(productProviderConfigurations)
			.values(productProviderConfiguration);
		await h.db.primary.insert(perks).values(perk);
		await h.db.primary.insert(productPerks).values(productPerk);
	});

	afterEach(async (t) => {
		const h = await IntegrationHarness.init(t);
		await h.db.primary
			.delete(productPerks)
			.where(eq(productPerks.productId, productId));
		await h.db.primary
			.delete(perks)
			.where(eq(perks.projectId, h.resources.project.id));
		await h.db.primary
			.delete(productProviderConfigurations)
			.where(eq(productProviderConfigurations.productId, productId));
		await h.db.primary.delete(products).where(eq(products.id, productId));
	});

	test("should create a subscription and grant perks for active status", async (t) => {
		const h = await IntegrationHarness.init(t);

		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "test@test.com",
			name: "Test Customer",
			createdAt: new Date(),
			updatedAt: new Date(),
			origin: "api" as const,
			projectId: h.resources.project.id,
			appUserId: "test-app-user-id",
		});

		const event: PurchaseEvent = {
			providerKey: generateId("test"),
			type: "subscription" as const,
			status: "active" as const,
			customerId: testCustomerId,
			providerProductId: productProviderConfigurationId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};

		const serviceContext = await createTestServiceContext();
		const result = await handleProductPurchase(serviceContext, event);

		const customerProduct = await h.db.primary.query.purchases.findFirst({
			where: eq(purchases.id, result.id),
		});

		// Verify customerProduct creation
		expect(customerProduct).toBeDefined();
		expect(customerProduct?.customerId).toBe(testCustomerId);
		expect(customerProduct?.providerProductId).toBe(
			productProviderConfigurationId
		);
		expect(customerProduct?.status).toBe("active");
		expect(customerProduct?.type).toBe("subscription");

		const dbCustomerProduct = await h.db.primary.query.purchases.findFirst({
			where: eq(purchases.id, result.id),
		});
		expect(dbCustomerProduct).toBeDefined();
		expect(dbCustomerProduct?.status).toBe("active");

		// Verify perk granting
		const unlockedPerks =
			await h.db.primary.query.customersUnlockedPerks.findMany({
				where: and(
					eq(customersUnlockedPerks.customerId, testCustomerId),
					eq(customersUnlockedPerks.unlockedByCustomerProductId, result.id)
				),
			});

		expect(unlockedPerks).toHaveLength(1);
		const unlockedPerkIds = unlockedPerks.map((p) => p.perkId);
		expect(unlockedPerkIds).toContain(perkId);

		t.onTestFinished(async () => {
			await h.db.primary.delete(purchases).where(eq(purchases.id, result.id));
			await h.db.primary
				.delete(customersUnlockedPerks)
				.where(eq(customersUnlockedPerks.customerId, testCustomerId));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	test("should throw error if event type is not subscription", async () => {
		const serviceContext = await createTestServiceContext();

		const testCustomerId = generateId("test"); // Use a generated ID as customer doesn't need to exist
		const testProviderProductId = productProviderConfigurationId; // Use harness resource

		const event = {
			providerKey: generateId("test"),
			type: "one_time" as const,
			status: "active" as const,
			customerId: testCustomerId,
			providerProductId: testProviderProductId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(),
		} satisfies Omit<PurchaseEvent, "type"> & { type: "one_time" };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			handleProductPurchase(serviceContext, event as any)
		).rejects.toThrow(VoidhashError);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			handleProductPurchase(serviceContext, event as any)
		).rejects.toThrow("Only subscription products are supported for now");
	});

	test("should throw error if customer not found", async () => {
		const serviceContext = await createTestServiceContext();
		const testProviderProductId = productProviderConfigurationId; // Use harness resource

		const nonExistentCustomerId = generateId("customer"); // Ensure this ID does not exist
		const event: PurchaseEvent = {
			providerKey: generateId("test"),
			type: "subscription" as const,
			status: "active" as const,
			customerId: nonExistentCustomerId,
			providerProductId: testProviderProductId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(),
		};

		await expect(handleProductPurchase(serviceContext, event)).rejects.toThrow(
			VoidhashError
		);
		await expect(handleProductPurchase(serviceContext, event)).rejects.toThrow(
			"Customer not found"
		);
	});

	test("should throw error if provider product not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// Create a test customer for this test
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "test-provider-product-not-found@test.com",
			name: "Test Customer PP NotFound",
			createdAt: new Date(),
			updatedAt: new Date(),
			origin: "api" as const,
			projectId: h.resources.project.id,
			appUserId: "test-ppnf-app-user-id",
		});

		const nonExistentProviderProductId = generateId("test"); // Ensure this ID does not exist
		const event: PurchaseEvent = {
			providerKey: generateId("test"),
			type: "subscription" as const,
			status: "active" as const,
			customerId: testCustomerId,
			providerProductId: nonExistentProviderProductId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(),
		};

		await expect(handleProductPurchase(serviceContext, event)).rejects.toThrow(
			VoidhashError
		);
		await expect(handleProductPurchase(serviceContext, event)).rejects.toThrow(
			"Provider product not found"
		);

		// Cleanup created customer
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	test("should create subscription but not grant perks if status is not active", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// Create a test customer for this test
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "test-not-active@test.com",
			name: "Test Customer Not Active",
			createdAt: new Date(),
			updatedAt: new Date(),
			origin: "api" as const,
			projectId: h.resources.project.id,
			appUserId: "test-na-app-user-id",
		});

		const event: PurchaseEvent = {
			providerKey: generateId("test"),
			type: "subscription" as const,
			status: "canceled" as const,
			customerId: testCustomerId,
			providerProductId: productProviderConfigurationId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
		};

		const result = await handleProductPurchase(serviceContext, event);

		// Verify customerProduct creation
		expect(result.id).toBeDefined();
		expect(result.customerId).toBe(testCustomerId);
		expect(result.providerProductId).toBe(productProviderConfigurationId);
		expect(result.status).toBe("canceled");

		const dbCustomerProduct = await h.db.primary.query.purchases.findFirst({
			where: eq(purchases.id, result.id),
		});
		expect(dbCustomerProduct).toBeDefined();
		expect(dbCustomerProduct?.status).toBe("canceled");

		// Verify NO perks granted
		const unlockedPerks =
			await h.db.primary.query.customersUnlockedPerks.findMany({
				where: eq(customersUnlockedPerks.customerId, testCustomerId),
			});

		expect(unlockedPerks).toHaveLength(0);

		// Cleanup created resources
		t.onTestFinished(async () => {
			await h.db.primary.delete(purchases).where(eq(purchases.id, result.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	// TODO: Add test for transaction context if IntegrationHarness supports it easily
	// test("should use transaction context if provided", async (t) => { ... });
});
