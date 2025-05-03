import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	purchases,
	customersUnlockedPerks,
	customers,
	Perk,
	Product,
	ProductPerk,
	ProductProviderConfiguration,
	products,
	productProviderConfigurations,
	productPerks,
	perks,
} from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import {
	handlePurchasedProductUpdated,
	PurchasedProductUpdateEvent,
} from "./on-purchased-product-updated";
import { VoidhashError } from "@voidhash/lib";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { eq } from "drizzle-orm";
import { createTestServiceContext } from "@/lib/testing/create-test-service-context";
import { handleProductPurchase } from "./on-product-purchased"; // Needed to create initial state

// Helper function to compare dates at the second level (truncating ms)
const compareSeconds = (date: Date | null | undefined): number | null => {
	if (!date) return null;
	return Math.round(date.getTime() / 1000);
};

describe.sequential("on-purchased-product-updated integration tests", () => {
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

	test("should update status to active and grant perks", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// 1. Setup: Create customer and initial trialing subscription
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "update-active@test.com",
			name: "Test Customer Update Active",
			projectId: h.resources.project.id,
			origin: "api",
			appUserId: generateId("test"),
		});

		const initialEvent = {
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
		const initialCustomerProduct = await handleProductPurchase(
			serviceContext,
			initialEvent
		);

		// Verify initial state (trialing, no perks)
		let perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(0);

		// 2. Event: Update status to active
		const updateEvent: PurchasedProductUpdateEvent = {
			customerProductId: initialCustomerProduct.id,
			status: "active",
			canceledAt: null,
			cancelAtPeriodEnd: false,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Example: expiration updated
		};

		// 3. Action: Handle the update
		await handlePurchasedProductUpdated(serviceContext, updateEvent);

		// 4. Assertions
		const updatedCustomerProduct = await h.db.primary.query.purchases.findFirst(
			{
				where: eq(purchases.id, initialCustomerProduct.id),
			}
		);
		expect(updatedCustomerProduct).toBeDefined();
		expect(updatedCustomerProduct?.status).toBe("active");
		expect(compareSeconds(updatedCustomerProduct?.expiresAt)).toBe(
			compareSeconds(updateEvent.expiresAt)
		);

		// Verify perks were granted
		perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(1);
		expect(perks[0]?.perkId).toBe(perkId);

		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customersUnlockedPerks)
				.where(
					eq(
						customersUnlockedPerks.unlockedByCustomerProductId,
						initialCustomerProduct.id
					)
				);
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.id, initialCustomerProduct.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	test("should update status to canceled and revoke perks", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// 1. Setup: Create customer and initial active subscription
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "update-cancel@test.com",
			name: "Test Customer Update Cancel",
			projectId: h.resources.project.id,
			origin: "api",
			appUserId: generateId("test"),
		});

		const initialEvent = {
			type: "subscription" as const,
			status: "active" as const, // Start as active to have perks
			customerId: testCustomerId,
			providerProductId: productProviderConfigurationId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: new Date(),
			cancelAtPeriodEnd: false,
			environment: "production" as const,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};
		const initialCustomerProduct = await handleProductPurchase(
			serviceContext,
			initialEvent
		);

		// Verify initial state (active, has perks)
		let perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(1); // Should have perks initially

		// 2. Event: Update status to canceled
		const updateEvent: PurchasedProductUpdateEvent = {
			customerProductId: initialCustomerProduct.id,
			status: "canceled",
			canceledAt: new Date(), // Set canceled date
			cancelAtPeriodEnd: false, // Or true, depending on scenario
			expiresAt: initialCustomerProduct.expiresAt, // Expiration might not change immediately
		};

		// 3. Action: Handle the update
		await handlePurchasedProductUpdated(serviceContext, updateEvent);

		// 4. Assertions
		const updatedCustomerProduct = await h.db.primary.query.purchases.findFirst(
			{
				where: eq(purchases.id, initialCustomerProduct.id),
			}
		);
		expect(updatedCustomerProduct).toBeDefined();
		expect(updatedCustomerProduct?.status).toBe("canceled");
		expect(compareSeconds(updatedCustomerProduct?.canceledAt)).toBe(
			compareSeconds(updateEvent.canceledAt)
		);
		// Verify perks were revoked
		perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(0); // Perks should be gone

		// 5. Cleanup
		// Perks already deleted by the handler in this case
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.id, initialCustomerProduct.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	test("should update non-status fields without affecting perks", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// 1. Setup: Create customer and initial active subscription
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "update-non-status@test.com",
			name: "Test Customer Update NonStatus",
			projectId: h.resources.project.id,
			origin: "api",
			appUserId: generateId("test"),
		});

		const initialEvent = {
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
		const initialCustomerProduct = await handleProductPurchase(
			serviceContext,
			initialEvent
		);

		// Verify initial state (active, has perks)
		let perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(1);

		// 2. Event: Update only non-status fields
		const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
		const updateEvent: PurchasedProductUpdateEvent = {
			customerProductId: initialCustomerProduct.id,
			status: "active", // Status remains the same
			canceledAt: null,
			cancelAtPeriodEnd: true, // Example: update cancelAtPeriodEnd
			expiresAt: newExpiresAt, // Example: update expiresAt
		};

		// 3. Action: Handle the update
		await handlePurchasedProductUpdated(serviceContext, updateEvent);

		// 4. Assertions
		const updatedCustomerProduct = await h.db.primary.query.purchases.findFirst(
			{
				where: eq(purchases.id, initialCustomerProduct.id),
			}
		);
		expect(updatedCustomerProduct).toBeDefined();
		expect(updatedCustomerProduct?.status).toBe("active"); // Still active
		expect(updatedCustomerProduct?.cancelAtPeriodEnd).toBe(true);
		expect(compareSeconds(updatedCustomerProduct?.expiresAt)).toBe(
			compareSeconds(updateEvent.expiresAt)
		);

		// Verify perks remain unchanged
		perks = await h.db.primary.query.customersUnlockedPerks.findMany({
			where: eq(
				customersUnlockedPerks.unlockedByCustomerProductId,
				initialCustomerProduct.id
			),
		});
		expect(perks).toHaveLength(1); // Perks should still be there

		// 5. Cleanup
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customersUnlockedPerks)
				.where(
					eq(
						customersUnlockedPerks.unlockedByCustomerProductId,
						initialCustomerProduct.id
					)
				);
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.id, initialCustomerProduct.id));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});

	test("should throw error if customer product not found", async () => {
		const serviceContext = await createTestServiceContext();

		const nonExistentCustomerProductId = generateId("customerProduct");
		const updateEvent: PurchasedProductUpdateEvent = {
			customerProductId: nonExistentCustomerProductId,
			status: "active",
			canceledAt: null,
			cancelAtPeriodEnd: false,
			expiresAt: new Date(),
		};

		await expect(
			handlePurchasedProductUpdated(serviceContext, updateEvent)
		).rejects.toThrow(VoidhashError);
		await expect(
			handlePurchasedProductUpdated(serviceContext, updateEvent)
		).rejects.toThrow(
			`Customer product with id ${nonExistentCustomerProductId} not found.`
		);
	});

	// Optional: Test for internal server error if provider product is missing
	// This requires manually creating inconsistent state (customerProduct exists, providerProduct doesn't)
	test("should throw error if provider product not found during perk update", async (t) => {
		const h = await IntegrationHarness.init(t);
		const serviceContext = await createTestServiceContext();

		// 1. Setup: Create customer and customerProduct directly, but NO providerProduct mapping
		const testCustomerId = generateId("test");
		await h.db.primary.insert(customers).values({
			id: testCustomerId,
			email: "inconsistent-data@test.com",
			name: "Test Inconsistent",
			projectId: h.resources.project.id,
			origin: "api",
			appUserId: generateId("test"),
		});

		const inconsistentProviderProductId = generateId("test");
		const customerProductId = generateId("customerProduct");
		await h.db.primary.insert(purchases).values({
			id: customerProductId,
			status: "trialing",
			type: "subscription",
			customerId: testCustomerId,
			providerProductId: inconsistentProviderProductId,
			purchasedAt: new Date(),
			startsAt: new Date(),
			canceledAt: null,
			cancelAtPeriodEnd: false,
			environment: "production",
			expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
		});

		// 2. Event: Trigger a status change that requires perk logic
		const updateEvent: PurchasedProductUpdateEvent = {
			customerProductId: customerProductId,
			status: "active",
			canceledAt: null,
			cancelAtPeriodEnd: false,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};

		// 3. Action & Assertion: Expect internal server error
		await expect(
			handlePurchasedProductUpdated(serviceContext, updateEvent)
		).rejects.toThrow(VoidhashError);

		// 4. Cleanup
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.id, customerProductId));
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, testCustomerId));
		});
	});
});
