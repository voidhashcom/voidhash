// import { generateId } from "@/lib/id/generate";
// import { IntegrationHarness } from "@/lib/testing/integration-harness";
// import {
// 	customers,
// 	InsertPaywallProduct,
// 	InsertProduct,
// 	paywallProducts,
// 	products,
// } from "@voidhash/db";
// import { describe, expect, test } from "vitest";
// import { sdkCustomerResponseSchema } from "./schema";
// import { eq } from "drizzle-orm";
// import { ANONYMOUS_USER_ID_PREFIX } from "@/lib/services/sdk/constants";

// describe.sequential("/v1/sdk/create-checkout", async () => {
// 	test("POST /v1/sdk/create-checkout - success", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const appUserId = generateId("test");
// 		const name = "Test User";
// 		const email = "test@example.com";

// 		const anonymousCustomer = {
// 			id: generateId("test"),
// 			projectId: h.resources.project.id,
// 			appUserId: `${ANONYMOUS_USER_ID_PREFIX}${generateId("test")}`,
// 			email: "initial@example.com",
// 			type: "anonymous",
// 			origin: "ios",
// 			environment: "production",
// 		} as const;
// 		// Ensure anonymous customer exists
// 		await h.db.primary.insert(customers).values(anonymousCustomer);

// 		// Create product
// 		const productInput: Omit<InsertProduct, "projectId"> = {
// 			id: generateId("test"),
// 			name: "Product Attached to Paywall",
// 			environment: "production",
// 		};
// 		await h.db.primary.insert(products).values({
// 			...productInput,
// 			projectId: h.resources.project.id,
// 		});

// 		// Link product to paywall
// 		const paywallProductInput: InsertPaywallProduct = {
// 			id: generateId("test"),
// 			paywallId: generateId("test"),
// 			productId: productInput.id,
// 			enableNativePurchase: true,
// 			enableWebCheckout: true,
// 		};

// 		await h.db.primary.insert(paywallProducts).values(paywallProductInput);

// 		const res = await h.post({
// 			url: "/v1/sdk/create-checkout",
// 			headers: {
// 				"x-publishable-key": h.resources.publishableKey.unhashedKey,
// 				"x-app-user-id": anonymousCustomer.appUserId,
// 				"Content-Type": "application/json",
// 			},
// 			body: {
// 				paywallProductId: "test",
// 			},
// 		});

// 		expect(
// 			res.status,
// 			`expected 200, received: ${JSON.stringify(res, null, 2)}`
// 		).toBe(200);

// 		const validatedBody = sdkCustomerResponseSchema.safeParse(res.body);
// 		expect(
// 			validatedBody.success,
// 			`Body validation failed: ${JSON.stringify(validatedBody.error, null, 2)}`
// 		).toBe(true);

// 		// Verify the response is correct
// 		if (validatedBody.success) {
// 			expect(validatedBody.data.appUserId).toBe(appUserId);
// 			expect(validatedBody.data.name).toBe(name);
// 			expect(validatedBody.data.email).toBe(email);
// 		}

// 		// Verify the new customer is created in the database
// 		const retrievedNewCustomer = await h.db.primary.query.customers.findFirst({
// 			where: eq(customers.appUserId, appUserId),
// 		});
// 		expect(retrievedNewCustomer).toBeDefined();
// 		expect(retrievedNewCustomer?.name).toBe(name);
// 		expect(retrievedNewCustomer?.email).toBe(email);
// 		expect(retrievedNewCustomer?.type).toBe("identified");

// 		// Verify the anonymous customer is archived
// 		const retrievedAnonymousCustomer =
// 			await h.db.primary.query.customers.findFirst({
// 				where: eq(customers.appUserId, anonymousCustomer.appUserId),
// 			});
// 		expect(retrievedAnonymousCustomer).toBeDefined();
// 		expect(retrievedAnonymousCustomer?.type).toBe("anonymous");
// 		expect(retrievedAnonymousCustomer?.parentCustomerId).toBe(
// 			retrievedNewCustomer?.id
// 		);
// 		expect(retrievedAnonymousCustomer?.archivedAt).toBeDefined();
// 	});
// });
