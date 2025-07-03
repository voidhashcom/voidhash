import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertProduct, products } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { Environment } from "@voidhash/lib/constants";

describe.sequential("/v1/products/:productId", async () => {
	test("DELETE /v1/products/:productId - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Directly insert a product for testing
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Product To Delete",
			environment: Environment.Production,
		};

		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		const res = await h.delete({
			url: `/v1/products/${productInput.id}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		expect(res.body).toEqual({ message: "Product deleted" });

		// Verify the product is deleted from the database
		const dbProduct = await h.db.primary.query.products.findFirst({
			where: eq(products.id, productInput.id),
		});
		expect(dbProduct).toBeUndefined();
	});

	test("DELETE /v1/products/:productId - not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentProductId = `non-existent-${generateId("test")}`;

		const res = await h.delete({
			url: `/v1/products/${nonExistentProductId}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		// Assuming deleteProduct service handles not found gracefully (e.g., 404)
		expect(
			res.status,
			`expected 404/500, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
	});
});
