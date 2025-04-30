import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { products } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { createProductBodySchema, productResponseSchema } from "./schema";

describe.sequential("/v1/products", async () => {
	test("POST /v1/products - create product", async (t) => {
		const h = await IntegrationHarness.init(t);

		const productInput: z.infer<typeof createProductBodySchema> = {
			name: `Test Product}`,
		};

		const res = await h.post({
			url: "/v1/products",
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: productInput,
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof productResponseSchema>;

		expect(responseBody.productId).toBeDefined();
		expect(responseBody.name).toBe(productInput.name);

		// Clean up the created product
		t.onTestFinished(async () => {
			if (responseBody?.productId) {
				await h.db.primary
					.delete(products)
					.where(eq(products.id, responseBody.productId));
			}
		});
	});
});
