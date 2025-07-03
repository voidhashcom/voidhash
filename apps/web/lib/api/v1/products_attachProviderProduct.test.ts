import { generateId } from "@/lib/id/generate";
import { and, eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertProduct,
	paymentProviderConfigurationProducts,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
	attachProviderProductBodySchema,
	providerProductResponseSchema,
} from "./schema";
import { stripe } from "@/lib/payment-providers/stripe/stripe";
import { Environment } from "@voidhash/lib/constants";

describe.sequential("/v1/products/:productId/provider-products", async () => {
	test("POST /v1/products/:productId/provider-products - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create a base product
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Base Product for Provider",
			environment: Environment.Production,
		};
		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		// Define provider product input (assuming Stripe for now)
		const providerProductInput: z.infer<
			typeof attachProviderProductBodySchema
		> = {
			providerId: "stripe",
			paymentProviderConfigurationId:
				h.resources.paymentProviderConfiguration.id,
			// These fields depend heavily on the Stripe configuration schema
			configuration: {
				productId: `prod_${generateId("test")}`,
				priceId: `price_${generateId("test")}`,
			} satisfies z.infer<
				ReturnType<typeof stripe.getProductConfigurationSchema>
			>,
		};

		const res = await h.post({
			url: `/v1/products/${productInput.id}/provider-products`,
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: providerProductInput,
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<
			typeof providerProductResponseSchema
		>;

		expect(responseBody.providerProductKey).toBeDefined(); // Key might be auto-generated or based on input
		expect(
			responseBody.providerConfiguration.paymentProviderConfigurationId
		).toBe(providerProductInput.paymentProviderConfigurationId);
		expect(responseBody.providerConfiguration.configuration).toEqual(
			providerProductInput.configuration
		);

		// Verify in DB
		const dbProviderProduct =
			await h.db.primary.query.paymentProviderConfigurationProducts.findFirst({
				where: and(
					eq(paymentProviderConfigurationProducts.productId, productInput.id),
					eq(
						paymentProviderConfigurationProducts.providerProductKey,
						responseBody.providerProductKey
					)
				),
			});
		expect(dbProviderProduct).toBeDefined();
		expect(dbProviderProduct?.paymentProviderConfigurationId).toBe(
			providerProductInput.paymentProviderConfigurationId
		);
		expect(dbProviderProduct?.configuration).toEqual(
			providerProductInput.configuration
		);

		// Clean up
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(paymentProviderConfigurationProducts)
				.where(
					eq(
						paymentProviderConfigurationProducts.providerProductKey,
						responseBody.providerProductKey
					)
				);
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});

	// TODO: Add tests for invalid providerId, missing configuration, non-existent productId etc.
});
