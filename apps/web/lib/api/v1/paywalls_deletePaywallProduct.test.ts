// import { generateId } from "@/lib/id/generate";
// import { and, eq } from "drizzle-orm";
// import { IntegrationHarness } from "@/lib/testing/integration-harness";
// import {
// 	InsertPaywall,
// 	paywalls,
// 	InsertProduct,
// 	products,
// 	paywallProducts,
// 	InsertPaywallProduct,
// } from "@voidhash/db";
// import { describe, expect, test } from "vitest";

// describe.sequential("/v1/paywalls/:paywallId/products/:productId", async () => {
// 	test("DELETE /v1/paywalls/:paywallId/products/:productId - success", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		// Create paywall
// 		const paywallInput: Omit<InsertPaywall, "projectId"> = {
// 			id: generateId("test"),
// 			name: "Paywall for Product Delete",
// 		};
// 		await h.db.primary.insert(paywalls).values({
// 			...paywallInput,
// 			projectId: h.resources.project.id,
// 		});

// 		// Create product
// 		const productInput: Omit<InsertProduct, "projectId"> = {
// 			id: generateId("test"),
// 			name: "Product to Delete from Paywall",
// 		};
// 		await h.db.primary.insert(products).values({
// 			...productInput,
// 			projectId: h.resources.project.id,
// 		});

// 		// Link product to paywall
// 		const linkInput: InsertPaywallProduct = {
// 			id: generateId("test"),
// 			paywallId: paywallInput.id,
// 			productId: productInput.id,
// 		};
// 		await h.db.primary.insert(paywallProducts).values(linkInput);

// 		const res = await h.delete({
// 			url: `/v1/paywalls/${paywallInput.id}/products/${productInput.id}`,
// 			headers: {
// 				"x-secret-key": h.resources.secretKey.unhashedKey,
// 			},
// 		});

// 		expect(
// 			res.status,
// 			`expected 200, received: ${JSON.stringify(res, null, 2)}`
// 		).toBe(200);

// 		expect(res.body).toEqual({ message: "Product removed from paywall" });

// 		// Verify the link is deleted from the database
// 		const dbLink = await h.db.primary.query.paywallProducts.findFirst({
// 			where: and(
// 				eq(paywallProducts.paywallId, paywallInput.id),
// 				eq(paywallProducts.productId, productInput.id)
// 			),
// 		});
// 		expect(dbLink).toBeUndefined();

// 		// Clean up product and paywall
// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(products)
// 				.where(eq(products.id, productInput.id));
// 			await h.db.primary
// 				.delete(paywalls)
// 				.where(eq(paywalls.id, paywallInput.id));
// 		});
// 	});

// 	test("DELETE /v1/paywalls/:paywallId/products/:productId - not found", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const productId = generateId("test");

// 		const res = await h.delete({
// 			url: `/v1/paywalls/${paywallId}/products/${productId}`,
// 			headers: {
// 				"x-secret-key": h.resources.secretKey.unhashedKey,
// 			},
// 		});

// 		// Assuming the service handles not found gracefully (e.g., 404)
// 		expect(
// 			res.status,
// 			`expected 404, received: ${JSON.stringify(res, null, 2)}`
// 		).toBe(404);
// 	});
// });
