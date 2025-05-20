import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertProduct,
	productProviderConfigurations,
	InsertProductProviderConfiguration,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { stripe } from "@/lib/payment-providers/stripe/stripe";

describe.sequential(
	"/v1/products/:productId/provider-products/:providerId/:providerProductKey",
	async () => {
		test("DELETE /v1/products/:productId/provider-products/:providerId/:providerProductKey - success", async (t) => {
			const h = await IntegrationHarness.init(t);

			// Create a base product
			const productInput: Omit<InsertProduct, "projectId"> = {
				id: generateId("test"),
				name: "Base Product for Delete Provider",
			};
			await h.db.primary.insert(products).values({
				...productInput,
				projectId: h.resources.project.id,
			});

			// Directly insert a provider product to delete
			const providerConfigToDelete: InsertProductProviderConfiguration = {
				id: generateId("test"),
				productId: productInput.id,
				providerId: "stripe",
				providerProductKey: `ppk_to_delete_${generateId("test")}`,
				configuration: {
					priceId: `price_to_delete_${generateId("test")}`,
					productId: `prod_to_delete_${generateId("test")}`,
				} satisfies z.infer<typeof stripe.products.productConfigurationSchema>,
				isActive: true,
			};
			await h.db.primary
				.insert(productProviderConfigurations)
				.values(providerConfigToDelete);

			const res = await h.delete({
				url: `/v1/products/${productInput.id}/provider-products/${providerConfigToDelete.providerId}/${providerConfigToDelete.providerProductKey}`,
				headers: {
					"x-secret-key": h.resources.secretKey.unhashedKey,
				},
			});

			expect(
				res.status,
				`expected 200, received: ${JSON.stringify(res, null, 2)}`
			).toBe(200);

			expect(res.body).toEqual({ message: "Provider product deleted" });

			// Verify deletion in DB
			const dbProviderProduct =
				await h.db.primary.query.productProviderConfigurations.findFirst({
					where: eq(
						productProviderConfigurations.id,
						providerConfigToDelete.id
					),
				});
			expect(dbProviderProduct).toBeUndefined();

			// Clean up base product
			t.onTestFinished(async () => {
				await h.db.primary
					.delete(products)
					.where(eq(products.id, productInput.id));
			});
		});

		test("DELETE /v1/products/:productId/provider-products/:providerId/:providerProductKey - not found", async (t) => {
			const h = await IntegrationHarness.init(t);
			const productId = generateId("test");
			const providerId = "stripe";
			const nonExistentKey = `ppk_nonexistent_${generateId("test")}`;

			const res = await h.delete({
				url: `/v1/products/${productId}/provider-products/${providerId}/${nonExistentKey}`,
				headers: {
					"x-secret-key": h.resources.secretKey.unhashedKey,
				},
			});

			// Assuming the service returns 404 when the provider product is not found
			expect(
				res.status,
				`expected 404, received: ${JSON.stringify(res, null, 2)}`
			).toBe(404);
		});
	}
);
