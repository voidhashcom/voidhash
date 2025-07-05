import { generateId } from "@/lib/id/generate";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import {
	CustomerOrigin,
	customers,
	CustomerType,
	InsertCustomer,
} from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { sdkCustomerResponseSchema } from "./schema";
import { eq } from "drizzle-orm";
import { ANONYMOUS_USER_ID_PREFIX } from "@/lib/core/sdk/constants";
import { Environment } from "@voidhash/lib/constants";

describe.sequential("/v1/sdk/identify", async () => {
	test("POST /v1/sdk/identify - existing anonymous customer - success", async (t) => {
		const h = await IntegrationHarness.init(t);
		const appUserId = generateId("test");
		const name = "Test User";
		const email = "test@example.com";

		const anonymousCustomer = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: `${ANONYMOUS_USER_ID_PREFIX}${generateId("test")}`,
			email: "initial@example.com",
			type: CustomerType.Anonymous,
			origin: CustomerOrigin.IOS,
			environment: Environment.Production,
		} as const;
		// Ensure anonymous customer exists
		await h.db.primary.insert(customers).values(anonymousCustomer);

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": anonymousCustomer.appUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId,
				name,
				email,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const validatedBody = sdkCustomerResponseSchema.safeParse(res.body);
		expect(
			validatedBody.success,
			`Body validation failed: ${JSON.stringify(validatedBody.error, null, 2)}`
		).toBe(true);

		// Verify the response is correct
		if (validatedBody.success) {
			expect(validatedBody.data.appUserId).toBe(appUserId);
			expect(validatedBody.data.name).toBe(name);
			expect(validatedBody.data.email).toBe(email);
		}

		// Verify the new customer is created in the database
		const retrievedNewCustomer = await h.db.primary.query.customers.findFirst({
			where: eq(customers.appUserId, appUserId),
		});
		expect(retrievedNewCustomer).toBeDefined();
		expect(retrievedNewCustomer?.name).toBe(name);
		expect(retrievedNewCustomer?.email).toBe(email);
		expect(retrievedNewCustomer?.type).toBe(CustomerType.Identified);

		// Verify the anonymous customer is archived
		const retrievedAnonymousCustomer =
			await h.db.primary.query.customers.findFirst({
				where: eq(customers.appUserId, anonymousCustomer.appUserId),
			});
		expect(retrievedAnonymousCustomer).toBeDefined();
		expect(retrievedAnonymousCustomer?.type).toBe(CustomerType.Anonymous);
		expect(retrievedAnonymousCustomer?.parentCustomerId).toBe(
			retrievedNewCustomer?.id
		);
		expect(retrievedAnonymousCustomer?.archivedAt).toBeDefined();
	});

	test("POST /v1/sdk/identify - not existing anonymous customer - success", async (t) => {
		const h = await IntegrationHarness.init(t);
		const appUserId = generateId("test");
		const name = "Test User";
		const email = "test@example.com";
		const anonymousAppUserId = `${ANONYMOUS_USER_ID_PREFIX}${generateId("test")}`;

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": anonymousAppUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId,
				name,
				email,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const validatedBody = sdkCustomerResponseSchema.safeParse(res.body);
		expect(
			validatedBody.success,
			`Body validation failed: ${JSON.stringify(validatedBody.error, null, 2)}`
		).toBe(true);

		// Verify the response is correct
		if (validatedBody.success) {
			expect(validatedBody.data.appUserId).toBe(appUserId);
			expect(validatedBody.data.name).toBe(name);
			expect(validatedBody.data.email).toBe(email);
		}

		// Verify the new customer is created in the database
		const retrievedNewCustomer = await h.db.primary.query.customers.findFirst({
			where: eq(customers.appUserId, appUserId),
		});
		expect(retrievedNewCustomer).toBeDefined();
		expect(retrievedNewCustomer?.name).toBe(name);
		expect(retrievedNewCustomer?.email).toBe(email);
		expect(retrievedNewCustomer?.type).toBe(CustomerType.Identified);

		// Verify the anonymous customer is archived
		const retrievedAnonymousCustomer =
			await h.db.primary.query.customers.findFirst({
				where: eq(customers.appUserId, anonymousAppUserId),
			});
		expect(retrievedAnonymousCustomer).not.toBeDefined();
	});

	test("POST /v1/sdk/identify - existing identified customer - success", async (t) => {
		const h = await IntegrationHarness.init(t);
		const appUserId = generateId("test");
		const name = "Test User";
		const email = "test@example.com";

		// Ensure customer exists for the project and appUserId
		await h.db.primary.insert(customers).values({
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: appUserId,
			type: CustomerType.Identified,
			email: "initial@example.com",
			origin: CustomerOrigin.IOS,
			environment: Environment.Production,
		});

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": appUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId,
				name,
				email,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const validatedBody = sdkCustomerResponseSchema.safeParse(res.body);
		expect(
			validatedBody.success,
			`Body validation failed: ${JSON.stringify(validatedBody.error, null, 2)}`
		).toBe(true);

		if (validatedBody.success) {
			expect(validatedBody.data.appUserId).toBe(appUserId);
			expect(validatedBody.data.name).toBe(null);
			expect(validatedBody.data.email).toBe("initial@example.com");
		}
	});

	test("POST /v1/sdk/identify - missing appUserId", async (t) => {
		const h = await IntegrationHarness.init(t);

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
			},
			body: {
				name: "Test User",
				email: "test@example.com",
			},
		});
		// This depends on how your zValidator handles missing required fields.
		// It might be a 400 or 422.
		expect(
			res.status,
			`expected 400, received: ${JSON.stringify(res, null, 2)}`
		).toBe(400);
	});

	test("POST /v1/sdk/identify - invalid email", async (t) => {
		const h = await IntegrationHarness.init(t);
		const appUserId = generateId("test");

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": appUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId,
				name: "Test User",
				email: "invalid-email",
			},
		});
		// This depends on how your zValidator handles schema validation.
		// It might be a 400 or 422.
		expect(
			res.status,
			`expected 400, received: ${JSON.stringify(res, null, 2)}`
		).toBe(400);
	});

	test("POST /v1/sdk/identify - anonymous session (already merged), appUserId is parent", async (t) => {
		const h = await IntegrationHarness.init(t);
		const parentAppUserId = generateId("test");
		const parentCustomerEmail = "parent@example.com";
		const parentName = "Parent";

		const parentCustomerValues: InsertCustomer = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: parentAppUserId,
			email: parentCustomerEmail,
			name: parentName,
			type: CustomerType.Identified,
			origin: CustomerOrigin.IOS,
			environment: Environment.Production,
		};
		await h.db.primary.insert(customers).values(parentCustomerValues);

		const anonymousCustId = generateId("test");
		const anonymousAppUserId = `${ANONYMOUS_USER_ID_PREFIX}${anonymousCustId}`;
		await h.db.primary.insert(customers).values({
			id: anonymousCustId,
			projectId: h.resources.project.id,
			appUserId: anonymousAppUserId,
			type: CustomerType.Anonymous,
			parentCustomerId: parentCustomerValues.id,
			origin: CustomerOrigin.IOS,
			environment: Environment.Production,
		});

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": anonymousAppUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId: parentAppUserId,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const validatedBody = sdkCustomerResponseSchema.safeParse(res.body);
		expect(validatedBody.success).toBe(true);
		if (!validatedBody.success) return;

		expect(validatedBody.data.customerId).toBe(parentCustomerValues.id);
		expect(validatedBody.data.appUserId).toBe(parentAppUserId);
		expect(validatedBody.data.email).toBe(parentCustomerEmail);
	});

	test("POST /v1/sdk/identify - anonymous session (already merged), appUserId is different", async (t) => {
		const h = await IntegrationHarness.init(t);
		const parentAppUserId = generateId("test");
		const parentCustomerValues: InsertCustomer = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: parentAppUserId,
			email: "p@p.com",
			name: "P",
			type: CustomerType.Identified,
			origin: CustomerOrigin.API,
			environment: Environment.Production,
		};
		await h.db.primary.insert(customers).values(parentCustomerValues);

		const anonymousCustId = generateId("test");
		const anonymousAppUserId = `${ANONYMOUS_USER_ID_PREFIX}${anonymousCustId}`;
		await h.db.primary.insert(customers).values({
			id: anonymousCustId,
			projectId: h.resources.project.id,
			appUserId: anonymousAppUserId,
			type: CustomerType.Anonymous,
			parentCustomerId: parentCustomerValues.id,
			origin: CustomerOrigin.API,
			environment: Environment.Production,
		});

		const differentAppUserId = generateId("test");

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": anonymousAppUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId: differentAppUserId,
			},
		});

		expect(
			res.status,
			`expected 409, received: ${JSON.stringify(res, null, 2)}`
		).toBe(409);
	});

	test("POST /v1/sdk/identify - identified session, appUserId is different", async (t) => {
		const h = await IntegrationHarness.init(t);
		const initialAppUserId = generateId("test");

		const initialCustomerValues: InsertCustomer = {
			id: generateId("test"),
			projectId: h.resources.project.id,
			appUserId: initialAppUserId,
			email: "i@i.com",
			name: "Initial",
			type: CustomerType.Identified,
			origin: CustomerOrigin.API,
			environment: Environment.Production,
		};
		await h.db.primary.insert(customers).values(initialCustomerValues);

		const differentAppUserId = generateId("test");

		const res = await h.post({
			url: "/v1/sdk/identify",
			headers: {
				"x-publishable-key": h.resources.publishableKey.unhashedKey,
				"x-app-user-id": initialAppUserId,
				"Content-Type": "application/json",
			},
			body: {
				appUserId: differentAppUserId,
			},
		});

		expect(res.status).toBe(200);

		const previousCustomer = await h.db.primary.query.customers.findFirst({
			where: eq(customers.appUserId, initialAppUserId),
		});
		expect(previousCustomer).toBeDefined();
		expect(previousCustomer?.type).toBe(CustomerType.Identified);
		expect(previousCustomer?.appUserId).toBe(initialAppUserId);
		expect(previousCustomer?.email).toBe(initialCustomerValues.email);
		expect(previousCustomer?.parentCustomerId).toBeNull();
		expect(previousCustomer?.archivedAt).toBeNull();

		const newCustomer = await h.db.primary.query.customers.findFirst({
			where: eq(customers.appUserId, differentAppUserId),
		});
		expect(newCustomer).toBeDefined();
		expect(newCustomer?.type).toBe(CustomerType.Identified);
		expect(newCustomer?.appUserId).toBe(differentAppUserId);
		expect(newCustomer?.parentCustomerId).toBeNull();
		expect(newCustomer?.archivedAt).toBeNull();
		expect(newCustomer?.id).not.toBe(previousCustomer?.id);
	});
});
