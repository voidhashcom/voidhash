import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest"; // Or your preferred test runner
import app from "./customers";

describe("Search Endpoint", () => {
	// Create the test client from the app instance
	const client = testClient(app);

	it("should return search results", async () => {
		const res = await client.index.$post({
			json: {
				name: "John Doe",
				email: "john.doe@example.com",
			},
		});
		// Assertions
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			query: "hono",
			results: ["result1", "result2"],
		});
	});
});
