import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertCustomer, customers } from "@voidhash/db";
import { describe, expect, test } from "vitest";

const customerInput: Omit<InsertCustomer, "projectId"> = {
	id: generateId("test"),
	email: "test@test.com",
	name: "Test Customer",
	appUserId: "test-app-user-id",
	origin: "api",
};

const expectedCustomer = {
	customerId: customerInput.id,
	email: customerInput.email,
	name: customerInput.name,
	origin: customerInput.origin,
	appUserId: customerInput.appUserId,
};

describe.sequential("/v1/customers/**", async () => {
	test("GET /v1/customers - empty list", async (t) => {
		const h = await IntegrationHarness.init(t);

		const res = await h.get({
			url: "/v1/customers",
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

	test("GET /v1/customers - customers", async (t) => {
		const h = await IntegrationHarness.init(t);

		await h.db.primary.insert(customers).values({
			...customerInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: "/v1/customers",
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);
		expect(res.body).toStrictEqual([expectedCustomer]);

		// Delete the customer
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(customers)
				.where(eq(customers.id, customerInput.id));
		});
	});
});
