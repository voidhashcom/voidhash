// import { generateId } from "@/lib/id/generate";
// import { and, eq } from "drizzle-orm";
// import { IntegrationHarness } from "@/lib/testing/integration-harness";
// import {
// 	InsertPaywall,
// 	paywalls,
// 	InsertProduct,
// 	products,
// 	paywallProducts,
// } from "@voidhash/db";
// import { describe, expect, test } from "vitest";
// import { z } from "zod";
// import {
// 	attachProductToPaywallBodySchema,
// 	paywallProductResponseSchema,
// } from "./schema";

// describe.sequential("/v1/paywalls/:paywallId/products", async () => {
// 	test("POST /v1/paywalls/:paywallId/products - success", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		// Create paywall
// 		const paywallInput: Omit<InsertPaywall, "projectId"> = {
// 			id: generateId("test"),
// 			name: "Paywall for Product Attach",
// 		};
// 		await h.db.primary.insert(paywalls).values({
// 			...paywallInput,
// 			projectId: h.resources.project.id,
// 		});

// 		// Create product
// 		const productInput: Omit<InsertProduct, "projectId"> = {
// 			id: generateId("test"),
// 			name: "Product to Attach to Paywall",
// 		};
// 		await h.db.primary.insert(products).values({
// 			...productInput,
// 			projectId: h.resources.project.id,
// 		});

// 		const attachInput: z.infer<typeof attachProductToPaywallBodySchema> = {
// 			productId: productInput.id,
// 		};

// 		const res = await h.post({
// 			url: `/v1/paywalls/${paywallInput.id}/products`,
// 			headers: {
// 				"Content-Type": "application/json",
// 				"x-secret-key": h.resources.secretKey.unhashedKey,
// 			},
// 			body: attachInput,
// 		});

// 		expect(
// 			res.status,
// 			`expected 200, received: ${JSON.stringify(res, null, 2)}`
// 		).toBe(200);

// 		const responseBody = res.body as z.infer<
// 			typeof paywallProductResponseSchema
// 		>;

// 		expect(responseBody.paywallId).toBe(paywallInput.id);
// 		expect(responseBody.productId).toBe(productInput.id);
// 		expect(responseBody.productName).toBeNull(); // Based on endpoint comment

// 		// Verify DB entry
// 		const dbLink = await h.db.primary.query.paywallProducts.findFirst({
// 			where: and(
// 				eq(paywallProducts.paywallId, paywallInput.id),
// 				eq(paywallProducts.productId, productInput.id)
// 			),
// 		});
// 		expect(dbLink).toBeDefined();

// 		// Clean up
// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallProducts)
// 				.where(
// 					and(
// 						eq(paywallProducts.paywallId, paywallInput.id),
// 						eq(paywallProducts.productId, productInput.id)
// 					)
// 				);
// 			await h.db.primary
// 				.delete(products)
// 				.where(eq(products.id, productInput.id));
// 			await h.db.primary
// 				.delete(paywalls)
// 				.where(eq(paywalls.id, paywallInput.id));
// 		});
// 	});

// 	// TODO: Add tests for non-existent paywallId, non-existent productId etc.
// });
