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
import { providerProductResponseSchema } from "./schema";

describe.sequential("/v1/products/:productId/provider-products", async () => {
	test("GET /v1/products/:productId/provider-products - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create a base product
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Base Product for Get Provider List",
		};
		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		// Directly insert provider products
		const providerConfig1: Omit<
			InsertProductProviderConfiguration,
			"productId"
		> = {
			id: generateId("test"),
			providerId: "stripe",
			providerProductKey: `ppk_${generateId("test")}`,
			configuration: { stripePriceId: `price_${generateId("test")}` }, // Simplified
			isActive: true,
		};
		await h.db.primary.insert(productProviderConfigurations).values({
			...providerConfig1,
			productId: productInput.id,
		});

		const res = await h.get({
			url: `/v1/products/${productInput.id}/provider-products`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<
			typeof providerProductResponseSchema
		>[];
		expect(responseBody).toHaveLength(1);
		expect(responseBody[0]!.providerProductKey).toBe(
			providerConfig1.providerProductKey
		);
		expect(responseBody[0]!.providerConfiguration.providerId).toBe(
			providerConfig1.providerId
		);
		expect(responseBody[0]!.providerConfiguration.configuration).toEqual(
			providerConfig1.configuration
		);

		// Clean up
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(productProviderConfigurations)
				.where(
					eq(
						productProviderConfigurations.providerProductKey,
						providerConfig1.providerProductKey
					)
				);
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});

	test("GET /v1/products/:productId/provider-products - empty list", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create a base product without provider products
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Base Product Empty List",
		};
		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: `/v1/products/${productInput.id}/provider-products`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);
		expect(res.body).toEqual([]);

		// Clean up
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});

	test("GET /v1/products/:productId/provider-products - product not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentProductId = `non-existent-${generateId("test")}`;

		const res = await h.get({
			url: `/v1/products/${nonExistentProductId}/provider-products`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		// The service might return an empty list even if the product doesn't exist.
		expect(
			res.status,
			`expected 404, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
	});
});
