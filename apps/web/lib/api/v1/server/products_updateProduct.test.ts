import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertProduct, products } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { productResponseSchema, updateProductBodySchema } from "./schema";

describe.sequential("/v1/products/:productId", async () => {
	test("PUT /v1/products/:productId - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Directly insert a product for testing
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Original Product Name",
		};

		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		const updateInput: z.infer<typeof updateProductBodySchema> = {
			name: "Updated Product Name",
		};

		const res = await h.put({
			url: `/v1/products/${productInput.id}`,
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: updateInput,
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof productResponseSchema>;

		expect(responseBody.productId).toBe(productInput.id);
		expect(responseBody.name).toBe(updateInput.name);

		// Verify the change in the database
		const dbProduct = await h.db.primary.query.products.findFirst({
			where: eq(products.id, productInput.id),
		});
		expect(dbProduct?.name).toBe(updateInput.name);

		// Clean up the created product
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});

	test("PUT /v1/products/:productId - not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentProductId = `non-existent-${generateId("test")}`;
		const updateInput: z.infer<typeof updateProductBodySchema> = {
			name: "Updated Product Name",
		};

		const res = await h.put({
			url: `/v1/products/${nonExistentProductId}`,
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: updateInput,
		});

		// Assuming updateProduct service throws an error leading to a 500 or similar
		// or potentially a 404 if handled gracefully. Let's expect 404 for now.
		expect(
			res.status,
			`expected 404/500, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404); // Adjust if the actual service function returns a different error
	});
});
