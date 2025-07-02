import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertProduct,
	paymentProviderConfigurationProducts,
	InsertPaymentProviderConfigurationProduct,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { stripe } from "@/lib/payment-providers/stripe/stripe";
import { RouteResponse, RouteRequest } from "./products_updateProviderProduct";
import { createPaymentProviderKey } from "@/lib/services/products/lib";

describe.sequential(
	"/v1/products/:productId/provider-products/:providerId/:providerProductKey",
	async () => {
		test("PUT /v1/products/:productId/provider-products/:providerId/:providerProductKey - success", async (t) => {
			const h = await IntegrationHarness.init(t);

			// Create a base product
			const productInput: Omit<InsertProduct, "projectId"> = {
				id: generateId("test"),
				name: "Base Product for Update Provider",
				environment: "production",
			};
			await h.db.primary.insert(products).values({
				...productInput,
				projectId: h.resources.project.id,
			});

			const providerProductKey = createPaymentProviderKey("stripe", {
				productId: `prod_123`,
				priceId: `price_123`,
			});

			if (providerProductKey.isErr()) {
				throw new Error("Failed to create provider product key");
			}

			// Directly insert an initial provider product
			const initialProviderConfig: InsertPaymentProviderConfigurationProduct = {
				id: generateId("test"),
				productId: productInput.id,
				paymentProviderConfigurationId:
					h.resources.paymentProviderConfiguration.id,
				providerProductKey: providerProductKey.value,
				configuration: {
					productId: `prod_123`,
					priceId: `price_123`,
				} satisfies z.infer<
					ReturnType<typeof stripe.getProductConfigurationSchema>
				>,
				isActive: true,
			};
			await h.db.primary
				.insert(paymentProviderConfigurationProducts)
				.values(initialProviderConfig);

			// Define the update payload
			const updatePayload: RouteRequest = {
				paymentProviderConfigurationId:
					h.resources.paymentProviderConfiguration.id,
				providerId: "stripe",
				configuration: {
					productId: `prod_123`,
					priceId: `price_123`,
				} satisfies z.infer<
					ReturnType<typeof stripe.getProductConfigurationSchema>
				>,
			};

			const res = await h.put<RouteRequest, RouteResponse>({
				url: `/v1/products/${productInput.id}/provider-products/${initialProviderConfig.paymentProviderConfigurationId}/${initialProviderConfig.providerProductKey}`,
				headers: {
					"Content-Type": "application/json",
					"x-secret-key": h.resources.secretKey.unhashedKey,
				},
				body: updatePayload,
			});

			expect(
				res.status,
				`expected 200, received: ${JSON.stringify(res, null, 2)}`
			).toBe(200);

			const responseBody = res.body;
			// Check response body
			expect(responseBody.providerProductKey).toBe(
				initialProviderConfig.providerProductKey
			);

			const {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				paymentProviderConfigurationId,
				...updatePayloadWithoutProviderConfigurationId
			} = updatePayload;
			console.log("=== RESPONSE BODY ====", responseBody.providerConfiguration);
			console.log(
				"=== UPDATE PAYLOAD WITHOUT PROVIDER CONFIGURATION ID ====",
				updatePayloadWithoutProviderConfigurationId
			);
			expect(responseBody.providerConfiguration).toMatchObject({
				configuration: updatePayload.configuration,
				paymentProviderConfigurationId:
					h.resources.paymentProviderConfiguration.id,
			});

			// Verify in DB
			const dbProviderProduct =
				await h.db.primary.query.paymentProviderConfigurationProducts.findFirst(
					{
						where: eq(
							paymentProviderConfigurationProducts.id,
							initialProviderConfig.id
						),
					}
				);

			expect(dbProviderProduct?.configuration).toMatchObject(
				updatePayload.configuration // The DB stores only the inner config
			);

			// Clean up
			t.onTestFinished(async () => {
				await h.db.primary
					.delete(paymentProviderConfigurationProducts)
					.where(
						eq(
							paymentProviderConfigurationProducts.id,
							initialProviderConfig.id
						)
					);
				await h.db.primary
					.delete(products)
					.where(eq(products.id, productInput.id));
			});
		});

		test("PUT /v1/products/:productId/provider-products/:providerId/:providerProductKey - not found", async (t) => {
			const h = await IntegrationHarness.init(t);
			const productId = generateId("test");
			const nonExistentKey = `ppk_nonexistent_${generateId("test")}`;
			const updatePayload: RouteRequest = {
				paymentProviderConfigurationId:
					h.resources.paymentProviderConfiguration.id,
				providerId: "stripe",
				configuration: {
					productId: `prod_123`,
					priceId: `price_update_fail`,
				} satisfies z.infer<
					ReturnType<typeof stripe.getProductConfigurationSchema>
				>,
			};

			const res = await h.put<RouteRequest, RouteResponse>({
				url: `/v1/products/${productId}/provider-products/${h.resources.paymentProviderConfiguration.id}/${nonExistentKey}`,
				headers: {
					"Content-Type": "application/json",
					"x-secret-key": h.resources.secretKey.unhashedKey,
				},
				body: updatePayload,
			});

			// Assuming the service returns 404 when the provider product is not found
			expect(
				res.status,
				`expected 404, received: ${JSON.stringify(res, null, 2)}`
			).toBe(404);
		});
	}
);
