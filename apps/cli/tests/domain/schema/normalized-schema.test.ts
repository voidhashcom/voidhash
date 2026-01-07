import { describe, expect, it } from "vitest";

import { createEmptyNormalizedSchema } from "../../../src/domain/schema/normalized-schema";

describe("createEmptyNormalizedSchema", () => {
	it("returns object with empty perks Map", () => {
		const schema = createEmptyNormalizedSchema();

		expect(schema.perks).toBeInstanceOf(Map);
		expect(schema.perks.size).toBe(0);
	});

	it("returns object with empty products Map", () => {
		const schema = createEmptyNormalizedSchema();

		expect(schema.products).toBeInstanceOf(Map);
		expect(schema.products.size).toBe(0);
	});

	it("returns object with empty enabledProviders Set", () => {
		const schema = createEmptyNormalizedSchema();

		expect(schema.enabledProviders).toBeInstanceOf(Set);
		expect(schema.enabledProviders.size).toBe(0);
	});

	it("maps are mutable", () => {
		const schema = createEmptyNormalizedSchema();

		schema.perks.set("test-perk", { slug: "test-perk", name: "Test Perk" });
		schema.products.set("test-product", {
			slug: "test-product",
			name: "Test Product",
			type: "subscription",
			perks: [],
			providers: [],
		});

		expect(schema.perks.size).toBe(1);
		expect(schema.products.size).toBe(1);
	});

	it("set is mutable", () => {
		const schema = createEmptyNormalizedSchema();

		schema.enabledProviders.add("appleAppStore");
		schema.enabledProviders.add("googlePlay");

		expect(schema.enabledProviders.size).toBe(2);
		expect(schema.enabledProviders.has("appleAppStore")).toBe(true);
		expect(schema.enabledProviders.has("googlePlay")).toBe(true);
	});

	it("each call returns a new instance", () => {
		const schema1 = createEmptyNormalizedSchema();
		const schema2 = createEmptyNormalizedSchema();

		// Modify schema1
		schema1.perks.set("perk", { slug: "perk", name: "Perk" });
		schema1.enabledProviders.add("appleAppStore");

		// schema2 should be unaffected
		expect(schema2.perks.size).toBe(0);
		expect(schema2.enabledProviders.size).toBe(0);

		// References should be different
		expect(schema1).not.toBe(schema2);
		expect(schema1.perks).not.toBe(schema2.perks);
		expect(schema1.products).not.toBe(schema2.products);
		expect(schema1.enabledProviders).not.toBe(schema2.enabledProviders);
	});
});
