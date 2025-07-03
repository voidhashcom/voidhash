import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertPaywall, paywalls } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { paywallResponseSchema } from "./schema";
import { Environment } from "@voidhash/lib/constants";

describe.sequential("/v1/paywalls/:paywallId", async () => {
	test("GET /v1/paywalls/:paywallId - success", async (t) => {
		const h = await IntegrationHarness.init(t);

		// Directly insert a paywall for testing
		const paywallInput: Omit<InsertPaywall, "projectId"> = {
			id: generateId("test"),
			name: "Get Paywall By ID Test",
			environment: Environment.Production,
		};

		await h.db.primary.insert(paywalls).values({
			...paywallInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: `/v1/paywalls/${paywallInput.id}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof paywallResponseSchema>;

		expect(responseBody.paywallId).toBe(paywallInput.id);
		expect(responseBody.name).toBe(paywallInput.name);

		// Clean up the created paywall
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(paywalls)
				.where(eq(paywalls.id, paywallInput.id));
		});
	});

	test("GET /v1/paywalls/:paywallId - not found", async (t) => {
		const h = await IntegrationHarness.init(t);
		const nonExistentPaywallId = `non-existent-${generateId("test")}`;

		const res = await h.get({
			url: `/v1/paywalls/${nonExistentPaywallId}`,
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 404, received: ${JSON.stringify(res, null, 2)}`
		).toBe(404);
		expect(res.body).toEqual({
			error: {
				code: "NOT_FOUND",
				docs: expect.any(String),
				message: "Paywall not found",
				requestId: expect.any(String),
			},
		});
	});
});
