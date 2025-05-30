import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	InsertPaywall,
	InsertPaywallLocation,
	InsertPaywallProduct,
	InsertProduct,
	paywallLocations,
	paywallProducts,
	paywalls,
	products,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { sdkPaywallResponseSchema } from "./schema";

describe.sequential(
	"/v1/sdk/get-paywall-by-location/:locationSlug",
	async () => {
		test("GET /v1/sdk/get-paywall-by-location/:locationSlug - success", async (t) => {
			const h = await IntegrationHarness.init(t);

			const productInput: Omit<InsertProduct, "projectId"> = {
				id: generateId("test"),
				name: "Test Product for Paywall",
				type: "subscription",
			};
			await h.db.primary.insert(products).values({
				...productInput,
				projectId: h.resources.project.id,
			});

			const paywallInput: Omit<InsertPaywall, "projectId"> = {
				id: generateId("test"),
				name: "Test Paywall",
			};
			await h.db.primary.insert(paywalls).values({
				...paywallInput,
				projectId: h.resources.project.id,
			});

			const paywallProductInput: InsertPaywallProduct = {
				id: generateId("test"),
				paywallId: paywallInput.id,
				productId: productInput.id,
				displayName: "Test Product Display Name",
				order: 0,
			};
			await h.db.primary.insert(paywallProducts).values(paywallProductInput);

			const locationSlug = `test-location-${generateId("test")}`;
			const paywallLocationInput: Omit<InsertPaywallLocation, "projectId"> = {
				id: generateId("test"),
				name: "Test Location",
				slug: locationSlug,
				defaultPaywallId: paywallInput.id,
			};
			await h.db.primary.insert(paywallLocations).values({
				...paywallLocationInput,
				projectId: h.resources.project.id,
			});

			const res = await h.get({
				url: `/v1/sdk/get-paywall-by-location/${locationSlug}`,
				headers: {
					"x-publishable-key": h.resources.publishableKey.key,
					"x-app-user-id": h.resources.user.id,
				},
			});

			expect(
				res.status,
				`expected 200, received: ${JSON.stringify(res, null, 2)}`
			).toBe(200);

			expect(res.body).toBeDefined();

			const responseBody = res.body as z.infer<typeof sdkPaywallResponseSchema>;

			expect(responseBody.paywallId).toBe(paywallInput.id);
			expect(responseBody.paywallProducts).toHaveLength(1);
			expect(responseBody.paywallProducts[0]?.productId).toBe(productInput.id);
			expect(responseBody.paywallProducts[0]?.displayName).toBe(
				paywallProductInput.displayName
			);
			expect(responseBody.paywallProducts[0]?.price).toBeNull();

			t.onTestFinished(async () => {
				await h.db.primary
					.delete(paywallProducts)
					.where(eq(paywallProducts.id, paywallProductInput.id));
				await h.db.primary
					.delete(paywallLocations)
					.where(eq(paywallLocations.id, paywallLocationInput.id));
				await h.db.primary
					.delete(paywalls)
					.where(eq(paywalls.id, paywallInput.id));
				await h.db.primary
					.delete(products)
					.where(eq(products.id, productInput.id));
			});
		});

		test("GET /v1/sdk/get-paywall-by-location/:locationSlug - not found", async (t) => {
			const h = await IntegrationHarness.init(t);
			const nonExistentLocationSlug = `non-existent-location-${generateId(
				"test"
			)}`;

			const res = await h.get({
				url: `/v1/sdk/get-paywall-by-location/${nonExistentLocationSlug}`,
				headers: {
					"x-publishable-key": h.resources.publishableKey.key,
					"x-app-user-id": h.resources.user.id,
				},
			});

			expect(
				res.status,
				`expected 404, received: ${JSON.stringify(res, null, 2)}`
			).toBe(404);

			// For 404, we expect an error object, not the sdkPaywallResponseSchema
			expect(res.body).toBeDefined(); // Ensure body is defined before accessing its properties

			const errorBody = res.body as {
				error: {
					code: string;
					docs: string;
					message: string;
					requestId: string;
				};
			};

			expect(errorBody.error.code).toBe("NOT_FOUND");
			expect(errorBody.error.docs).toEqual(expect.any(String));
			expect(errorBody.error.requestId).toEqual(expect.any(String));
		});
	}
);
