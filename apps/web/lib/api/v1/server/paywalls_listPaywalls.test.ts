import { generateId } from "@/lib/id/generate";
import { eq } from "drizzle-orm";
import { IntegrationHarness } from "@/lib/testing/integration-harness";
import { InsertPaywall, paywalls } from "@voidhash/db";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { paywallResponseSchema } from "./schema";

const paywallInput: Omit<InsertPaywall, "projectId"> = {
	id: generateId("test"),
	name: "Test Paywall for List",
};

const expectedPaywall: z.infer<typeof paywallResponseSchema> = {
	paywallId: paywallInput.id,
	name: paywallInput.name,
};

describe.sequential("/v1/paywalls/**", async () => {
	test("GET /v1/paywalls - empty list", async (t) => {
		const h = await IntegrationHarness.init(t);

		const res = await h.get({
			url: "/v1/paywalls",
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

	test("GET /v1/paywalls - paywalls", async (t) => {
		const h = await IntegrationHarness.init(t);

		await h.db.primary.insert(paywalls).values({
			...paywallInput,
			projectId: h.resources.project.id,
		});

		const res = await h.get({
			url: "/v1/paywalls",
			headers: {
				"x-secret-key": h.resources.secretKey.unhashedKey,
			},
		});

		expect(
			res.status,
			`expected 200, received: ${JSON.stringify(res, null, 2)}`
		).toBe(200);

		const responseBody = res.body as z.infer<typeof paywallResponseSchema>[];
		expect(responseBody).toStrictEqual([
			{ ...expectedPaywall, projectId: h.resources.project.id },
		]);

		// Delete the paywall
		t.onTestFinished(async () => {
			await h.db.primary
				.delete(paywalls)
				.where(eq(paywalls.id, paywallInput.id));
		});
	});
});
