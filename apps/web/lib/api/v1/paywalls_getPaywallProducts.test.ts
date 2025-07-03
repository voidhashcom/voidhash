import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertPaywall,
	paywalls,
	InsertProduct,
	products,
	paywallProducts,
	InsertPaywallProduct,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { paywallProductResponseSchema } from "./schema";
import { Environment } from "@voidhash/lib/constants";

describe.sequential("/v1/paywalls/:paywallId/products", async () => {
	test("GET /v1/paywalls/:paywallId/products - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create paywall
		const paywallInput: Omit<InsertPaywall, "projectId"> = {
			id: generateId("test"),
			name: "Paywall for Get Products",
			environment: Environment.Production,
		};
		await h.db.primary.insert(paywalls).values({
			...paywallInput,
			projectId: h.resources.project.id,
		});

		// Create product
		const productInput: Omit<InsertProduct, "projectId"> = {
			id: generateId("test"),
			name: "Product Attached to Paywall",
			environment: Environment.Production,
		};
		await h.db.primary.insert(products).values({
			...productInput,
			projectId: h.resources.project.id,
		});

		// Link product to paywall
		const linkInput: InsertPaywallProduct = {
			id: generateId("test"),
			paywallId: paywallInput.id,
			productId: productInput.id,
		};
		await h.db.primary.insert(paywallProducts).values(linkInput);

		const res = await h.get({
			url: `/v1/paywalls/${paywallInput.id}/products`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<
			typeof paywallProductResponseSchema
		>[];
		expect(responseBody).toHaveLength(1);
		expect(responseBody[0]!.paywallId).toBe(paywallInput.id);
		expect(responseBody[0]!.productId).toBe(productInput.id);
		expect(responseBody[0]!.productName).toBe(productInput.name);

		// Clean up
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(paywallProducts)
				.where(eq(paywallProducts.id, linkInput.id));
			await h.db.primary
				.delete(products)
				.where(eq(products.id, productInput.id));
			await h.db.primary
				.delete(paywalls)
				.where(eq(paywalls.id, paywallInput.id));
		});
	});

	test("GET /v1/paywalls/:paywallId/products - empty list", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Create paywall without products
		const paywallInput: Omit<InsertPaywall, "projectId"> = {
			id: generateId("test"),
			name: "Empty Paywall",
			environment: Environment.Production,
		};
		await h.db.primary.insert(paywalls).values({
			...paywallInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: `/v1/paywalls/${paywallInput.id}/products`,
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
				.delete(paywalls)
				.where(eq(paywalls.id, paywallInput.id));
		});
	});

	test("GET /v1/paywalls/:paywallId/products - paywall not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentPaywallId = `non-existent-${generateId("test")}`;

		const res = await h.get({
			url: `/v1/paywalls/${nonExistentPaywallId}/products`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		// Service likely returns empty array for non-existent paywall
		expect(
			res.status,
			`expected 404, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
		expect(res.body).toEqual({
			error: {
				code: "NOT_FOUND",
				docs: expect.any(String),
				message: "Paywall " + nonExistentPaywallId + " not found",
				requestId: expect.any(String),
			},
		});
	});
});
