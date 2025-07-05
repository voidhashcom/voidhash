import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { customers } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ANONYMOUS_USER_ID_PREFIX } from "@/lib/core/sdk/constants";
import { sdkCustomerResponseSchema } from "./schema";

describe.sequential("/v1/sdk/customers/**", async () => {
	test("GET /v1/sdk/get-customer - not existing - anonymous - success", async (t) => {
		const h = await IntegrationHarness.init(t);
		const testAppUserId = `${ANONYMOUS_USER_ID_PREFIX}${generateId("test")}`;

		const res = await h.get({
			url: `/v1/sdk/get-customer`,
			headers: {
				"x-publishable-key": h.resources.publishableKey.key,
				"x-app-user-id": testAppUserId,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof sdkCustomerResponseSchema>;

		expect(responseBody.customerId).toBeDefined();
		expect(responseBody.email).toBeNull();
		expect(responseBody.name).toBeNull();
		expect(responseBody.appUserId).toBe(testAppUserId);

		// Clean up the created customer
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.appUserId, testAppUserId));
		});
	});

	test("GET /v1/sdk/get-customer - existing - anonymous - success", async (t) => {
		const h = await IntegrationHarness.init(t);
		const testAppUserId = `${ANONYMOUS_USER_ID_PREFIX}${generateId("test")}`;

		const createCustomerRes = await h.get({
			url: `/v1/sdk/get-customer`,
			headers: {
				"x-publishable-key": h.resources.publishableKey.key,
				"x-app-user-id": testAppUserId,
			},
		});

		const createCustomerResponseBody = createCustomerRes.body as z.infer<
			typeof sdkCustomerResponseSchema
		>;

		const res = await h.get({
			url: `/v1/sdk/get-customer`,
			headers: {
				"x-publishable-key": h.resources.publishableKey.key,
				"x-app-user-id": testAppUserId,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof sdkCustomerResponseSchema>;

		expect(responseBody.customerId).toBe(createCustomerResponseBody.customerId);
		expect(responseBody.email).toBe(createCustomerResponseBody.email);
		expect(responseBody.name).toBe(createCustomerResponseBody.name);
		expect(responseBody.appUserId).toBe(testAppUserId);

		// Clean up the created customer
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.appUserId, testAppUserId));
		});
	});
});
