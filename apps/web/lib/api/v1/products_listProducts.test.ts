import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertProduct, products } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { productResponseSchema } from "./schema";

const productInput: Omit<InsertProduct, "projectId"> = {
	id: generateId("test"),
	name: "Test Product for List",
	environment: "production",
};

const expectedProduct: z.infer<typeof productResponseSchema> = {
	productId: productInput.id,
	name: productInput.name,
};

describe.sequential("/v1/products/**", async () => {
	test("GET /v1/products - empty list", async (t) => {
		const h = await IntegrationHarness.init(t);

		const res = await h.get({
			url: "/v1/products",
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);
		expect(res.body).toEqual([]);
	});

	test("GET /v1/products - products", async (t) => {
		const h = await IntegrationHarness.init(t);

		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: "/v1/products",
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof productResponseSchema>[];
		expect(responseBody).toStrictEqual([expectedProduct]);

		// Delete the product
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
		});
	});
});
