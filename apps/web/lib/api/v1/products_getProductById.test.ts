import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertProduct, products } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { productResponseSchema } from "./schema";

describe.sequential("/v1/products/:productId", async () => {
	test("GET /v1/products/:productId - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Directly insert a product for testing
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Get Product By ID Test",
		};

		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: `/v1/products/${productInput.id}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof productResponseSchema>;

		expect(responseBody.productId).toBe(productInput.id);
		expect(responseBody.name).toBe(productInput.name);

		// Clean up the created product
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});

	test("GET /v1/products/:productId - not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentProductId = `non-existent-${generateId("test")}`;

		const res = await h.get({
			url: `/v1/products/${nonExistentProductId}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 404, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
		expect(res.body).toEqual({
			error: {
				code: "NOT_FOUND",
				docs: expect.any(String),
				message: "Product not found",
				requestId: expect.any(String),
			},
		});
	});
});
