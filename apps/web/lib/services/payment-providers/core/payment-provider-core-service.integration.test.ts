import { generateId } from "@/lib/id/generate";
import { devCheckout } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { createTestServiceContext } from "@/lib/testing/create-test-service-context";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	and,
	charges,
	customers,
	eq,
	InsertCustomer,
	InsertProduct,
	InsertPaymentProviderConfigurationProduct,
	paymentProviderConfigurationProducts,
	products,
	purchases,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { createPaymentProviderCoreService } from "./payment-provider-core-service";

describe.sequential("payment-provider-core-service", async () => {
	test("process subscription purchase successfully", async (t) => {
		const h = await IntegrationHarness.init(t);
		const ctx = await createTestServiceContext();
		const service = createPaymentProviderCoreService();

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

		const paymentProviderConfigurationProductInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			paymentProviderConfigurationId:
				h.resources.paymentProviderConfiguration.id,
			providerProductKey: devCheckout.createProductKey({
				productId: productInsert.id,
			}),
			configuration: {
				productId: productInsert.id,
			},
		} satisfies InsertPaymentProviderConfigurationProduct;

		await h.db.primary
			.insert(paymentProviderConfigurationProducts)
			.values(paymentProviderConfigurationProductInsert);

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

		const paymentProviderConfigurationProductResult =
			await service.getPaymentProviderConfigurationProductById(
				ctx,
				paymentProviderConfigurationProductInsert.id
			);

		if (paymentProviderConfigurationProductResult.isErr()) {
			throw paymentProviderConfigurationProductResult.error;
		}

		const paymentProviderConfigurationProduct =
			paymentProviderConfigurationProductResult.value;

		const purchseKey = generateId("test");
		const processSubscriptionPurchaseResult =
			await service.processSubscriptionPurchase(
				ctx,
				"production",
				paymentProviderConfigurationProduct,
				{
					customerId: customerInsert.id,
					status: "active",
					purchasedAt: new Date(),
					startsAt: new Date(),
					canceledAt: null,
					cancelAtPeriodEnd: false,
					expiresAt: new Date(),
					providerKey: purchseKey,
					charge: {
						amount: 1000,
						currency: "USD",
					},
				}
			);

		if (processSubscriptionPurchaseResult.isErr()) {
			throw processSubscriptionPurchaseResult.error;
		}

		const purchase = await h.db.primary.query.purchases.findFirst({
			where: and(
				eq(purchases.providerKey, purchseKey),
				eq(purchases.customerId, customerInsert.id)
			),
		});

		const charge = await h.db.primary.query.charges.findFirst({
			where: and(
				eq(charges.customerId, customerInsert.id),
				eq(
					charges.paymentProviderConfigurationProductId,
					paymentProviderConfigurationProduct.id
				),
				eq(charges.purchaseEnvironment, "production")
			),
		});

		expect(purchase).toBeDefined();
		expect(purchase?.status).toBe("active");
		expect(purchase?.type).toBe("subscription");
		expect(purchase?.customerId).toBe(customerInsert.id);
		expect(purchase?.paymentProviderConfigurationProductId).toBe(
			paymentProviderConfigurationProduct.id
		);
		expect(purchase?.startsAt).toBeDefined();
		expect(purchase?.canceledAt).toBeNull();
		expect(purchase?.cancelAtPeriodEnd).toBe(false);
		expect(purchase?.purchaseEnvironment).toBe("production");
		expect(purchase?.purchasedAt).toBeDefined();
		expect(purchase?.expiresAt).toBeDefined();
		expect(purchase?.providerKey).toBe(purchseKey);

		expect(charge).toBeDefined();
		expect(charge?.amount).toBe(1000);
		expect(charge?.currency).toBe("USD");
		expect(charge?.paymentProviderConfigurationProductId).toBe(
			paymentProviderConfigurationProduct.id
		);
		expect(charge?.purchaseEnvironment).toBe("production");
		expect(charge?.customerId).toBe(customerInsert.id);
		expect(charge?.purchaseId).toBe(purchase?.id);

		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, customerInsert.id));
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInsert.id));
			await h.db.primary
				.delete(paymentProviderConfigurationProducts)
				.where(
					eq(paymentProviderConfigurationProducts.productId, productInsert.id)
				);
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.customerId, customerInsert.id));
		});
	});
});
