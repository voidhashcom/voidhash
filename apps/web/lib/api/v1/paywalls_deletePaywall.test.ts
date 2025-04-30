import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertPaywall, paywalls } from "@voidhash/db";
import { describe, expect, test } from "vitest";

describe.sequential("/v1/paywalls/:paywallId", async () => {
	test("DELETE /v1/paywalls/:paywallId - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Directly insert a paywall for testing
		const paywallInput: Omit<InsertPaywall, "projectId"> = {
			id: generateId("test"),
			name: "Paywall To Delete",
		};

		await h.db.primary.insert(paywalls).values({
			...paywallInput,
			projectId: h.resources.project.id,
		});

		const res = await h.delete({
			url: `/v1/paywalls/${paywallInput.id}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		expect(res.body).toEqual({ message: "Paywall deleted" });

		// Verify the paywall is deleted from the database
		const dbPaywall = await h.db.primary.query.paywalls.findFirst({
			where: eq(paywalls.id, paywallInput.id),
		});
		expect(dbPaywall).toBeUndefined();
	});

	test("DELETE /v1/paywalls/:paywallId - not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentPaywallId = `non-existent-${generateId("test")}`;

		const res = await h.delete({
			url: `/v1/paywalls/${nonExistentPaywallId}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		// Assuming deletePaywall service handles not found gracefully (e.g., 404)
		expect(
			res.status,
			`expected 404/500, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
	});
});
