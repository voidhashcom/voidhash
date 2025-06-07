import { generateId } from "@/lib/id/generate";
import {
	devCheckout,
	devCheckoutPaymentProviderId,
} from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { createTestServiceContext } from "@/lib/testing/create-test-service-context";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	and,
	charges,
	customers,
	eq,
	InsertCustomer,
	InsertProduct,
	InsertProductProviderConfiguration,
	productProviderConfigurations,
	products,
	purchases,
	Transaction,
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

		const productProviderConfigurationInsert = {
			id: generateId("test"),
			productId: productInsert.id,
			providerId: devCheckoutPaymentProviderId,
			projectId: h.resources.project.id,
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

		await h.db.primary.transaction(async (tx: Transaction) => {
			const productProviderConfigurationResult =
				await service.getProductProviderConfigurationByProductId(
					{ ...ctx, tx: tx },
					productInsert.id,
					devCheckoutPaymentProviderId
				);

			if (productProviderConfigurationResult.isErr()) {
				throw productProviderConfigurationResult.error;
			}

			const productProviderConfiguration =
				productProviderConfigurationResult.value;

			const purchseKey = generateId("test");
			const processSubscriptionPurchaseResult =
				await service.processSubscriptionPurchase(
					ctx,
					tx,
					"production",
					productProviderConfiguration,
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

			const purchase = await tx.query.purchases.findFirst({
				where: and(
					eq(purchases.providerKey, purchseKey),
					eq(purchases.customerId, customerInsert.id)
				),
			});

			const charge = await tx.query.charges.findFirst({
				where: and(
					eq(charges.customerId, customerInsert.id),
					eq(charges.paymentProviderId, devCheckoutPaymentProviderId),
					eq(charges.purchaseEnvironment, "production")
				),
			});

			expect(charge).toBeDefined();
			expect(charge?.amount).toBe(1000);
			expect(charge?.currency).toBe("USD");
			expect(charge?.paymentProviderId).toBe(devCheckoutPaymentProviderId);
			expect(charge?.purchaseEnvironment).toBe("production");
			expect(charge?.customerId).toBe(customerInsert.id);

			expect(purchase).toBeDefined();
			expect(purchase?.status).toBe("active");
			expect(purchase?.type).toBe("subscription");
			expect(purchase?.customerId).toBe(customerInsert.id);
			expect(purchase?.providerProductId).toBe(productProviderConfiguration.id);
			expect(purchase?.startsAt).toBeDefined();
			expect(purchase?.canceledAt).toBeNull();
			expect(purchase?.cancelAtPeriodEnd).toBe(false);
			expect(purchase?.purchaseEnvironment).toBe("production");
			expect(purchase?.purchasedAt).toBeDefined();
			expect(purchase?.expiresAt).toBeDefined();
			expect(purchase?.providerKey).toBe(purchseKey);
		});

		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, customerInsert.id));
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInsert.id));
			await h.db.primary
				.delete(productProviderConfigurations)
				.where(eq(productProviderConfigurations.productId, productInsert.id));
			await h.db.primary
				.delete(purchases)
				.where(eq(purchases.customerId, customerInsert.id));
		});
	});
});
