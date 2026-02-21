import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Exit, Layer } from "effect";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
	extractPerkSlugs,
	extractProviderConfigs,
	isPaywallLocationDefinition,
	isPerkDefinition,
	isProductDefinition,
	isSchemaConfiguration,
	loadLocalSchema,
	SCHEMA_KIND,
	SchemaKind,
	slugToCamelCase,
} from "../../../src/utils/schema/local-schema-loader";

// Create a minimal layer for testing that only includes what we need
const TestLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

describe("slugToCamelCase", () => {
	it("converts hyphenated slug", () => {
		expect(slugToCamelCase("all-access")).toBe("allAccess");
	});

	it("converts underscored slug", () => {
		expect(slugToCamelCase("monthly_sub")).toBe("monthlySub");
	});

	it("handles simple slug", () => {
		expect(slugToCamelCase("simple")).toBe("simple");
	});

	it("handles multi-part slug", () => {
		expect(slugToCamelCase("multi-part-slug")).toBe("multiPartSlug");
	});

	it("handles uppercase", () => {
		expect(slugToCamelCase("UPPER_CASE")).toBe("upperCase");
	});

	it("handles mixed separators", () => {
		expect(slugToCamelCase("foo-bar_baz")).toBe("fooBarBaz");
	});

	it("handles empty string", () => {
		expect(slugToCamelCase("")).toBe("");
	});
});

describe("extractPerkSlugs", () => {
	it("returns empty array for undefined config", () => {
		const allPerks = new Map<string, { slug: string; name: string }>();
		expect(extractPerkSlugs(undefined, allPerks)).toEqual([]);
	});

	it("returns empty array for empty config", () => {
		const allPerks = new Map<string, { slug: string; name: string }>();
		expect(extractPerkSlugs({}, allPerks)).toEqual([]);
	});

	it("extracts enabled perks (value=true)", () => {
		const allPerks = new Map<string, { slug: string; name: string }>([
			["all-access", { slug: "all-access", name: "All Access" }],
			["premium", { slug: "premium", name: "Premium" }],
		]);
		const config = { allAccess: true, premium: false };

		const result = extractPerkSlugs(config, allPerks);

		expect(result).toEqual(["all-access"]);
	});

	it("skips metadata key '_'", () => {
		const allPerks = new Map<string, { slug: string; name: string }>([
			["all-access", { slug: "all-access", name: "All Access" }],
		]);
		const config = {
			_: { perks: {} } as unknown as boolean,
			allAccess: true,
		};

		const result = extractPerkSlugs(config, allPerks);

		expect(result).toEqual(["all-access"]);
	});

	it("correctly maps camelCase keys to slugs via allPerks map", () => {
		const allPerks = new Map<string, { slug: string; name: string }>([
			["premium-features", { slug: "premium-features", name: "Premium" }],
			["all-access", { slug: "all-access", name: "All Access" }],
		]);
		const config = { premiumFeatures: true, allAccess: true };

		const result = extractPerkSlugs(config, allPerks);

		expect(result).toContain("premium-features");
		expect(result).toContain("all-access");
	});

	it("ignores perks not in allPerks map", () => {
		const allPerks = new Map<string, { slug: string; name: string }>([
			["existing-perk", { slug: "existing-perk", name: "Existing" }],
		]);
		const config = { nonExistentPerk: true };

		const result = extractPerkSlugs(config, allPerks);

		expect(result).toEqual([]);
	});
});

describe("extractProviderConfigs", () => {
	it("returns empty array for undefined config", () => {
		expect(extractProviderConfigs(undefined)).toEqual([]);
	});

	it("returns empty array for empty config", () => {
		expect(extractProviderConfigs({})).toEqual([]);
	});

	it("extracts appleAppStore provider", () => {
		const config = {
			appleAppStore: { productId: "com.app.monthly" },
		};

		const result = extractProviderConfigs(config);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			providerId: "appleAppStore",
			configuration: { productId: "com.app.monthly" },
		});
	});

	it("extracts googlePlay provider", () => {
		const config = {
			googlePlay: { productId: "monthly_subscription" },
		};

		const result = extractProviderConfigs(config);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			providerId: "googlePlay",
			configuration: { productId: "monthly_subscription" },
		});
	});

	it("ignores unknown provider IDs", () => {
		const config = {
			unknownProvider: { productId: "test" },
			appleAppStore: { productId: "com.app.1" },
		};

		const result = extractProviderConfigs(config);

		expect(result).toHaveLength(1);
		expect(result[0]?.providerId).toBe("appleAppStore");
	});

	it("skips metadata key '_'", () => {
		const config = {
			_: { paymentProviders: {} },
			appleAppStore: { productId: "com.app.1" },
		};

		const result = extractProviderConfigs(config);

		expect(result).toHaveLength(1);
		expect(result[0]?.providerId).toBe("appleAppStore");
	});

	it("ignores null/undefined config values", () => {
		const config = {
			appleAppStore: null,
			googlePlay: undefined,
		};

		const result = extractProviderConfigs(config as Record<string, unknown>);

		expect(result).toEqual([]);
	});

	it("extracts configuration object correctly", () => {
		const config = {
			appleAppStore: { productId: "com.app.1", groupId: "group123" },
		};

		const result = extractProviderConfigs(config);

		expect(result[0]?.configuration).toEqual({
			productId: "com.app.1",
			groupId: "group123",
		});
	});
});

describe("type guards", () => {
	describe("isSchemaConfiguration", () => {
		it("returns true for object with correct symbol", () => {
			const obj = {
				[SCHEMA_KIND]: SchemaKind.SchemaConfiguration,
				perks: {},
				providers: {},
				location: () => {},
				subscription: () => {},
			};
			expect(isSchemaConfiguration(obj)).toBe(true);
		});

		it("returns false for null", () => {
			expect(isSchemaConfiguration(null)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isSchemaConfiguration("string")).toBe(false);
			expect(isSchemaConfiguration(123)).toBe(false);
			expect(isSchemaConfiguration(undefined)).toBe(false);
		});

		it("returns false for object without symbol", () => {
			const obj = {
				perks: {},
				providers: {},
				location: () => {},
				subscription: () => {},
			};
			expect(isSchemaConfiguration(obj)).toBe(false);
		});

		it("returns false for object with wrong symbol value", () => {
			const obj = {
				[SCHEMA_KIND]: SchemaKind.Perk,
				perks: {},
				providers: {},
				location: () => {},
				subscription: () => {},
			};
			expect(isSchemaConfiguration(obj)).toBe(false);
		});
	});

	describe("isPaywallLocationDefinition", () => {
		it("returns true for object with correct symbol", () => {
			const obj = {
				[SCHEMA_KIND]: SchemaKind.PaywallLocation,
				description: "Shown after onboarding",
				name: "Onboarding",
				slug: "onboarding",
			};
			expect(isPaywallLocationDefinition(obj)).toBe(true);
		});

		it("returns false for null", () => {
			expect(isPaywallLocationDefinition(null)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isPaywallLocationDefinition("string")).toBe(false);
		});

		it("returns false for object without symbol", () => {
			const obj = { name: "Onboarding", slug: "onboarding" };
			expect(isPaywallLocationDefinition(obj)).toBe(false);
		});
	});

	describe("isPerkDefinition", () => {
		it("returns true for object with correct symbol", () => {
			const obj = {
				[SCHEMA_KIND]: SchemaKind.Perk,
				slug: "test-perk",
				name: "Test Perk",
			};
			expect(isPerkDefinition(obj)).toBe(true);
		});

		it("returns false for null", () => {
			expect(isPerkDefinition(null)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isPerkDefinition("string")).toBe(false);
		});

		it("returns false for object without symbol", () => {
			const obj = { slug: "test", name: "Test" };
			expect(isPerkDefinition(obj)).toBe(false);
		});
	});

	describe("isProductDefinition", () => {
		it("returns true for object with correct symbol", () => {
			const obj = {
				[SCHEMA_KIND]: SchemaKind.Product,
				type: "subscription",
				slug: "test-product",
				properties: { name: "Test" },
				configuration: {},
			};
			expect(isProductDefinition(obj)).toBe(true);
		});

		it("returns false for null", () => {
			expect(isProductDefinition(null)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isProductDefinition(123)).toBe(false);
		});

		it("returns false for object without symbol", () => {
			const obj = {
				type: "subscription",
				slug: "test",
				properties: { name: "Test" },
				configuration: {},
			};
			expect(isProductDefinition(obj)).toBe(false);
		});
	});
});

describe("loadLocalSchema", () => {
	const fixturesPath = path.resolve(__dirname, "../../fixtures");

	it(
		"fails with LocalSchemaNotFoundError when file doesn't exist",
		async () => {
			await Effect.runPromise(
				Effect.gen(function* () {
				const result = yield* Effect.exit(
					loadLocalSchema("/non/existent/path.ts"),
				);

				expect(Exit.isFailure(result)).toBe(true);
				if (Exit.isFailure(result)) {
					const error = result.cause;
					expect(error._tag).toBe("Fail");
				}
				}).pipe(Effect.provide(TestLayer)),
			);
		},
	);

	it("extracts perks from SchemaConfiguration", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
			const schemaPath = path.join(fixturesPath, "valid-schema.ts");
			const result = yield* loadLocalSchema(schemaPath);

			expect(result.perks.size).toBe(2);
			expect(result.perks.has("all-access")).toBe(true);
			expect(result.perks.has("premium-features")).toBe(true);

			const allAccessPerk = result.perks.get("all-access");
			expect(allAccessPerk?.name).toBe("All Access");
			}).pipe(Effect.provide(TestLayer)),
		);
	});

	it("extracts enabled providers from SchemaConfiguration", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
			const schemaPath = path.join(fixturesPath, "valid-schema.ts");
			const result = yield* loadLocalSchema(schemaPath);

			expect(result.enabledProviders.has("appleAppStore")).toBe(true);
			expect(result.enabledProviders.has("googlePlay")).toBe(true);
			}).pipe(Effect.provide(TestLayer)),
		);
	});

	it("extracts products with perks and providers", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
			const schemaPath = path.join(fixturesPath, "valid-schema.ts");
			const result = yield* loadLocalSchema(schemaPath);

			expect(result.products.size).toBe(2);
			expect(result.products.has("monthly-plan")).toBe(true);
			expect(result.products.has("yearly-plan")).toBe(true);

			const monthlyPlan = result.products.get("monthly-plan");
			expect(monthlyPlan?.name).toBe("Monthly Plan");
			expect(monthlyPlan?.perks).toContain("all-access");
			expect(monthlyPlan?.providers).toHaveLength(2);

			const yearlyPlan = result.products.get("yearly-plan");
			expect(yearlyPlan?.name).toBe("Yearly Plan");
			expect(yearlyPlan?.perks).toContain("all-access");
			expect(yearlyPlan?.perks).toContain("premium-features");
			}).pipe(Effect.provide(TestLayer)),
		);
	});

	it("extracts paywall locations", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
			const schemaPath = path.join(fixturesPath, "valid-schema.ts");
			const result = yield* loadLocalSchema(schemaPath);

			expect(result.locations.size).toBe(2);
			expect(result.locations.has("onboarding-upsell")).toBe(true);
			expect(result.locations.has("settings-paywall")).toBe(true);

			const onboardingUpsell = result.locations.get("onboarding-upsell");
			expect(onboardingUpsell?.name).toBe("Onboarding Upsell");
			expect(onboardingUpsell?.description).toBe("Shown after onboarding");

			const settingsPaywall = result.locations.get("settings-paywall");
			expect(settingsPaywall?.name).toBe("Settings Paywall");
			expect(settingsPaywall?.description).toBeNull();
			}).pipe(Effect.provide(TestLayer)),
		);
	});

	it("handles empty schema", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
			const schemaPath = path.join(fixturesPath, "empty-schema.ts");
			const result = yield* loadLocalSchema(schemaPath);

			expect(result.perks.size).toBe(0);
			expect(result.products.size).toBe(0);
			expect(result.locations.size).toBe(0);
			expect(result.enabledProviders.size).toBe(0);
			}).pipe(Effect.provide(TestLayer)),
		);
	});
});
