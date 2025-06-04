import { generateId } from "@/lib/id/generate";
import { and, eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertProduct,
	productProviderConfigurations,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
	attachProviderProductBodySchema,
	providerProductResponseSchema,
} from "./schema";
import { stripe } from "@/lib/payment-providers-v0/stripe/stripe";

describe.sequential("/v1/products/:productId/provider-products", async () => {
	test("POST /v1/products/:productId/provider-products - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create a base product
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Base Product for Provider",
			environment: "production",
		};
		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		// Define provider product input (assuming Stripe for now)
		// NOTE: Adjust configuration based on actual schema/paymentProviders definition
		const providerProductInput: z.infer<
			typeof attachProviderProductBodySchema
		> = {
			providerId: "stripe", // Assuming 'stripe' is a valid provider ID
			configuration: {
				// These fields depend heavily on the Stripe configuration schema
				productId: `prod_${generateId("test")}`,
				priceId: `price_${generateId("test")}`,
			} satisfies z.infer<typeof stripe.products.productConfigurationSchema>,
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
		expect(responseBody.providerConfiguration.providerId).toBe(
			providerProductInput.providerId
		);
		expect(responseBody.providerConfiguration.configuration).toEqual(
			providerProductInput.configuration
		);

		// Verify in DB
		const dbProviderProduct =
			await h.db.primary.query.productProviderConfigurations.findFirst({
				where: and(
					eq(productProviderConfigurations.productId, productInput.id),
					eq(
						productProviderConfigurations.providerProductKey,
						responseBody.providerProductKey
					)
				),
			});
		expect(dbProviderProduct).toBeDefined();
		expect(dbProviderProduct?.providerId).toBe(providerProductInput.providerId);
		expect(dbProviderProduct?.configuration).toEqual(
			providerProductInput.configuration
		);

		// Clean up
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(productProviderConfigurations)
				.where(
					eq(
						productProviderConfigurations.providerProductKey,
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
