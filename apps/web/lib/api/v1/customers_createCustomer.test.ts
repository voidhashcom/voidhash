import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { customers } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import {
	CustomersCreateCustomerRequestBody,
	CustomersCreateCustomerResponse,
} from "./customers_createCustomer";

describe.sequential("/v1/customers", async () => {
	test("POST /v1/customers - create customer", async (t) => {
		const h = await IntegrationHarness.init(t);
		const testAppUserId = generateId("test");
		const customerInput: CustomersCreateCustomerRequestBody = {
			email: "test@test.com",
			name: "Test Customer",
			appUserId: testAppUserId,
		};

		const res = await h.post({
			url: "/v1/customers",
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: customerInput,
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as CustomersCreateCustomerResponse;

		expect(responseBody.customerId).toBeDefined();
		expect(responseBody.email).toBe(customerInput.email);
		expect(responseBody.name).toBe(customerInput.name);
		expect(responseBody.appUserId).toBe(customerInput.appUserId);
		expect(responseBody.origin).toBe("api");

		// Clean up the created customer
		t.onTestFinished(async () => {
			if (responseBody?.customerId) {
				await h.db.primary
					.delete(customers)
					.where(eq(customers.id, responseBody.customerId));
			}
		});
	});

	test("POST /v1/customers - create customer minimal", async (t) => {
		const h = await IntegrationHarness.init(t);
		const customerInput: CustomersCreateCustomerRequestBody = {
			email: "minimal@test.com",
		};

		const res = await h.post({
			url: "/v1/customers",
			headers: {
				"Content-Type": "application/json",
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
			body: customerInput,
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as CustomersCreateCustomerResponse;

		expect(responseBody.customerId).toBeDefined();
		expect(responseBody.email).toBe(customerInput.email);
		expect(responseBody.name).toBeNull();
		expect(responseBody.appUserId).toBeNull();
		expect(responseBody.origin).toBe("api");

		// Clean up the created customer
		t.onTestFinished(async () => {
			if (responseBody?.customerId) {
				await h.db.primary
					.delete(customers)
					.where(eq(customers.id, responseBody.customerId));
			}
		});
	});
});
