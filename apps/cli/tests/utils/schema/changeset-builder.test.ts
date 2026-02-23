import { describe, expect, it } from "vitest";

import {
	buildChangeset,
	formatChange,
	formatChangeShort,
} from "../../../src/utils/schema/changeset-builder";
import { computeDiff } from "../../../src/utils/schema/diff";
import {
	createProviderConfig,
	createTestPaywallLocation,
	createTestPerk,
	createTestProduct,
	createTestSchema,
} from "../../helpers/schema-factories";

describe("buildChangeset", () => {
	describe("empty diff", () => {
		it("returns empty changeset for empty diff", () => {
			const local = createTestSchema({});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(0);
		});
	});

	describe("paywall location changes", () => {
		it("generates create-paywall-location for new locations", () => {
			const local = createTestSchema({
				locations: [
					createTestPaywallLocation({
						description: "Shown on launch",
						name: "Onboarding",
						slug: "onboarding",
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(1);
			expect(changeset.changes[0]).toEqual({
				changeType: "create-paywall-location",
				key: "onboarding",
				payload: {
					description: "Shown on launch",
					name: "Onboarding",
					slug: "onboarding",
				},
			});
		});

		it("generates update-paywall-location for updated locations", () => {
			const local = createTestSchema({
				locations: [
					createTestPaywallLocation({
						description: null,
						name: "Onboarding New",
						slug: "onboarding",
					}),
				],
			});
			const remote = createTestSchema({
				locations: [
					createTestPaywallLocation({
						description: "Shown on launch",
						name: "Onboarding Old",
						slug: "onboarding",
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(1);
			expect(changeset.changes[0]).toEqual({
				changeType: "update-paywall-location",
				key: "onboarding",
				payload: {
					description: null,
					name: "Onboarding New",
					slug: "onboarding",
				},
			});
		});

		it("generates archive-paywall-location for remote-only locations", () => {
			const local = createTestSchema({});
			const remote = createTestSchema({
				locations: [
					createTestPaywallLocation({
						name: "Onboarding",
						slug: "onboarding",
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(1);
			expect(changeset.changes[0]).toEqual({
				changeType: "archive-paywall-location",
				key: "onboarding",
				payload: { slug: "onboarding" },
			});
		});
	});

	describe("perk changes", () => {
		it("generates create-perk for new perks", () => {
			const local = createTestSchema({
				perks: [createTestPerk({ slug: "new-perk", name: "New Perk" })],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(1);
			expect(changeset.changes[0]).toEqual({
				changeType: "create-perk",
				key: "new-perk",
				payload: { name: "New Perk", slug: "new-perk" },
			});
		});

		it("generates update-perk for updated perks", () => {
			const local = createTestSchema({
				perks: [createTestPerk({ slug: "perk-1", name: "Updated Name" })],
			});
			const remote = createTestSchema({
				perks: [createTestPerk({ slug: "perk-1", name: "Original Name" })],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(1);
			expect(changeset.changes[0]).toEqual({
				changeType: "update-perk",
				key: "perk-1",
				payload: { name: "Updated Name", slug: "perk-1" },
			});
		});

		it("generates multiple perk changes in correct order", () => {
			const local = createTestSchema({
				perks: [
					createTestPerk({ slug: "new-perk", name: "New" }),
					createTestPerk({ slug: "updated-perk", name: "Updated Local" }),
				],
			});
			const remote = createTestSchema({
				perks: [createTestPerk({ slug: "updated-perk", name: "Updated Remote" })],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			expect(changeset.changes).toHaveLength(2);
			// Creates should come before updates
			expect(changeset.changes[0]?.changeType).toBe("create-perk");
			expect(changeset.changes[1]?.changeType).toBe("update-perk");
		});
	});

	describe("product creation", () => {
		it("generates create-product for new products", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "new-product",
						name: "New Product",
						perks: [],
						providers: [],
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const createProductChange = changeset.changes.find(
				(c) => c.changeType === "create-product",
			);
			expect(createProductChange).toEqual({
				changeType: "create-product",
				key: "new-product",
				payload: { name: "New Product", slug: "new-product" },
			});
		});

		it("generates create-product-perk for each perk on new product", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "new-product",
						name: "New Product",
						perks: ["perk-1", "perk-2"],
						providers: [],
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const productPerkChanges = changeset.changes.filter(
				(c) => c.changeType === "create-product-perk",
			);
			expect(productPerkChanges).toHaveLength(2);
			expect(productPerkChanges).toContainEqual({
				changeType: "create-product-perk",
				key: "new-product:perk-1",
				payload: { perkSlug: "perk-1", productSlug: "new-product" },
			});
			expect(productPerkChanges).toContainEqual({
				changeType: "create-product-perk",
				key: "new-product:perk-2",
				payload: { perkSlug: "perk-2", productSlug: "new-product" },
			});
		});

		it("generates create-payment-provider-product for each provider on new product", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "new-product",
						name: "New Product",
						perks: [],
						providers: [
							createProviderConfig("appleAppStore", {
								productId: "com.app.monthly",
							}),
							createProviderConfig("googlePlay", {
								productId: "monthly_subscription",
							}),
						],
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const providerChanges = changeset.changes.filter(
				(c) => c.changeType === "create-payment-provider-product",
			);
			expect(providerChanges).toHaveLength(2);
			expect(providerChanges).toContainEqual({
				changeType: "create-payment-provider-product",
				key: "new-product:appleAppStore",
				payload: {
					configuration: { productId: "com.app.monthly" },
					productSlug: "new-product",
					providerId: "appleAppStore",
				},
			});
		});

		it("generates changes in correct order: product, then perks, then providers", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "new-product",
						name: "New Product",
						perks: ["perk-1"],
						providers: [
							createProviderConfig("appleAppStore", { productId: "com.app.1" }),
						],
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const changeTypes = changeset.changes.map((c) => c.changeType);
			const productIndex = changeTypes.indexOf("create-product");
			const perkIndex = changeTypes.indexOf("create-product-perk");
			const providerIndex = changeTypes.indexOf("create-payment-provider-product");

			expect(productIndex).toBeLessThan(perkIndex);
			expect(perkIndex).toBeLessThan(providerIndex);
		});
	});

	describe("product updates", () => {
		it("generates update-product when name changes", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Updated Name",
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Original Name",
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const updateProductChange = changeset.changes.find(
				(c) => c.changeType === "update-product",
			);
			expect(updateProductChange).toEqual({
				changeType: "update-product",
				key: "product-1",
				payload: { name: "Updated Name", slug: "product-1" },
			});
		});

		it("does not generate update-product when only perks/providers change", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1", "perk-2"],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1"],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const updateProductChange = changeset.changes.find(
				(c) => c.changeType === "update-product",
			);
			expect(updateProductChange).toBeUndefined();
		});

		it("generates create-product-perk for newly added perks", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1", "perk-2"],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1"],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const createPerkChanges = changeset.changes.filter(
				(c) => c.changeType === "create-product-perk",
			);
			expect(createPerkChanges).toHaveLength(1);
			expect(createPerkChanges[0]).toEqual({
				changeType: "create-product-perk",
				key: "product-1:perk-2",
				payload: { perkSlug: "perk-2", productSlug: "product-1" },
			});
		});

		it("does not generate delete-product-perk for removed perks", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1"],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						perks: ["perk-1", "perk-2"],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const deleteChanges = changeset.changes.filter(
				(c) => c.changeType === "delete-product-perk",
			);
			expect(deleteChanges).toHaveLength(0);
		});

		it("generates create-payment-provider-product for new provider", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [
							createProviderConfig("appleAppStore", { productId: "com.app.1" }),
						],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const createProviderChanges = changeset.changes.filter(
				(c) => c.changeType === "create-payment-provider-product",
			);
			expect(createProviderChanges).toHaveLength(1);
			expect(createProviderChanges[0]).toEqual({
				changeType: "create-payment-provider-product",
				key: "product-1:appleAppStore",
				payload: {
					configuration: { productId: "com.app.1" },
					productSlug: "product-1",
					providerId: "appleAppStore",
				},
			});
		});

		it("generates update-payment-provider-product for changed config", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [
							createProviderConfig("appleAppStore", {
								productId: "com.app.new",
							}),
						],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [
							createProviderConfig("appleAppStore", {
								productId: "com.app.old",
							}),
						],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const updateProviderChanges = changeset.changes.filter(
				(c) => c.changeType === "update-payment-provider-product",
			);
			expect(updateProviderChanges).toHaveLength(1);
			expect(updateProviderChanges[0]).toEqual({
				changeType: "update-payment-provider-product",
				key: "product-1:appleAppStore",
				payload: {
					configuration: { productId: "com.app.new" },
					productSlug: "product-1",
					providerId: "appleAppStore",
				},
			});
		});

		it("does not generate delete for removed providers", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [],
					}),
				],
			});
			const remote = createTestSchema({
				products: [
					createTestProduct({
						slug: "product-1",
						name: "Product",
						providers: [
							createProviderConfig("appleAppStore", { productId: "com.app.1" }),
						],
					}),
				],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const deleteChanges = changeset.changes.filter(
				(c) => c.changeType === "delete-payment-provider-product",
			);
			expect(deleteChanges).toHaveLength(0);
		});
	});

	describe("ordering", () => {
		it("orders: create-paywall-location before create-perk", () => {
			const local = createTestSchema({
				locations: [
					createTestPaywallLocation({
						name: "Onboarding",
						slug: "onboarding",
					}),
				],
				perks: [createTestPerk({ slug: "new-perk", name: "New" })],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const locationIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-paywall-location",
			);
			const perkIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-perk",
			);

			expect(locationIndex).toBeLessThan(perkIndex);
		});

		it("orders: create-perk before update-perk", () => {
			const local = createTestSchema({
				perks: [
					createTestPerk({ slug: "new-perk", name: "New" }),
					createTestPerk({ slug: "updated-perk", name: "Updated Local" }),
				],
			});
			const remote = createTestSchema({
				perks: [createTestPerk({ slug: "updated-perk", name: "Updated Remote" })],
			});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const createIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-perk",
			);
			const updateIndex = changeset.changes.findIndex(
				(c) => c.changeType === "update-perk",
			);

			expect(createIndex).toBeLessThan(updateIndex);
		});

		it("orders: perk changes before product changes", () => {
			const local = createTestSchema({
				perks: [createTestPerk({ slug: "new-perk", name: "New" })],
				products: [createTestProduct({ slug: "new-product", name: "New" })],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const perkIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-perk",
			);
			const productIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-product",
			);

			expect(perkIndex).toBeLessThan(productIndex);
		});

		it("orders: create-product before product-perk and provider changes", () => {
			const local = createTestSchema({
				products: [
					createTestProduct({
						slug: "new-product",
						name: "New",
						perks: ["perk-1"],
						providers: [
							createProviderConfig("appleAppStore", { productId: "com.app.1" }),
						],
					}),
				],
			});
			const remote = createTestSchema({});
			const diff = computeDiff(local, remote);

			const changeset = buildChangeset(diff);

			const productIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-product",
			);
			const perkIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-product-perk",
			);
			const providerIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-payment-provider-product",
			);

			expect(productIndex).toBeLessThan(perkIndex);
			expect(productIndex).toBeLessThan(providerIndex);
		});

		it("orders: archive-paywall-location after creates/updates", () => {
			const local = createTestSchema({
				locations: [
					createTestPaywallLocation({
						name: "Onboarding New",
						slug: "onboarding",
					}),
				],
				perks: [createTestPerk({ slug: "new-perk", name: "New" })],
			});
			const remote = createTestSchema({
				locations: [
					createTestPaywallLocation({
						name: "Legacy",
						slug: "legacy",
					}),
					createTestPaywallLocation({
						description: "Old",
						name: "Onboarding Old",
						slug: "onboarding",
					}),
				],
			});
			const diff = computeDiff(local, remote);
			const changeset = buildChangeset(diff);

			const createLocationIndex = changeset.changes.findIndex(
				(c) => c.changeType === "create-paywall-location",
			);
			const updateLocationIndex = changeset.changes.findIndex(
				(c) => c.changeType === "update-paywall-location",
			);
			const archiveLocationIndex = changeset.changes.findIndex(
				(c) => c.changeType === "archive-paywall-location",
			);

			expect(createLocationIndex).toBe(-1);
			expect(updateLocationIndex).toBeGreaterThan(-1);
			expect(archiveLocationIndex).toBeGreaterThan(updateLocationIndex);
		});
	});
});

describe("formatChange", () => {
	it("formats paywall location changes correctly", () => {
		expect(
			formatChange({
				changeType: "create-paywall-location",
				key: "onboarding",
				payload: {
					description: "Shown after onboarding",
					name: "Onboarding",
					slug: "onboarding",
				},
			}),
		).toBe('+ Create paywall location: onboarding ("Onboarding")');

		expect(
			formatChange({
				changeType: "update-paywall-location",
				key: "onboarding",
				payload: {
					description: null,
					name: "Onboarding Updated",
					slug: "onboarding",
				},
			}),
		).toBe('~ Update paywall location: onboarding ("Onboarding Updated")');

		expect(
			formatChange({
				changeType: "archive-paywall-location",
				key: "onboarding",
				payload: { slug: "onboarding" },
			}),
		).toBe("- Archive paywall location: onboarding");
	});

	it("formats create-perk correctly", () => {
		const result = formatChange({
			changeType: "create-perk",
			key: "all-access",
			payload: { name: "All Access", slug: "all-access" },
		});
		expect(result).toBe('+ Create perk: all-access ("All Access")');
	});

	it("formats update-perk correctly", () => {
		const result = formatChange({
			changeType: "update-perk",
			key: "all-access",
			payload: { name: "All Access Updated", slug: "all-access" },
		});
		expect(result).toBe('~ Update perk: all-access ("All Access Updated")');
	});

	it("formats create-product correctly", () => {
		const result = formatChange({
			changeType: "create-product",
			key: "monthly",
			payload: { name: "Monthly Plan", slug: "monthly" },
		});
		expect(result).toBe('+ Create product: monthly ("Monthly Plan")');
	});

	it("formats update-product correctly", () => {
		const result = formatChange({
			changeType: "update-product",
			key: "monthly",
			payload: { name: "Monthly Plan Updated", slug: "monthly" },
		});
		expect(result).toBe('~ Update product: monthly ("Monthly Plan Updated")');
	});

	it("formats create-product-perk correctly", () => {
		const result = formatChange({
			changeType: "create-product-perk",
			key: "monthly:all-access",
			payload: { perkSlug: "all-access", productSlug: "monthly" },
		});
		expect(result).toBe('+ Link perk "all-access" to product "monthly"');
	});

	it("formats delete-product-perk correctly", () => {
		const result = formatChange({
			changeType: "delete-product-perk",
			key: "monthly:all-access",
			payload: { perkSlug: "all-access", productSlug: "monthly" },
		});
		expect(result).toBe('- Unlink perk "all-access" from product "monthly"');
	});

	it("formats create-payment-provider-product correctly", () => {
		const result = formatChange({
			changeType: "create-payment-provider-product",
			key: "monthly:appleAppStore",
			payload: {
				configuration: { productId: "com.app.monthly" },
				productSlug: "monthly",
				providerId: "appleAppStore",
			},
		});
		expect(result).toBe('+ Configure appleAppStore for product "monthly"');
	});

	it("formats update-payment-provider-product correctly", () => {
		const result = formatChange({
			changeType: "update-payment-provider-product",
			key: "monthly:appleAppStore",
			payload: {
				configuration: { productId: "com.app.monthly.v2" },
				productSlug: "monthly",
				providerId: "appleAppStore",
			},
		});
		expect(result).toBe('~ Update appleAppStore config for product "monthly"');
	});

	it("formats delete-payment-provider-product correctly", () => {
		const result = formatChange({
			changeType: "delete-payment-provider-product",
			key: "monthly:appleAppStore",
			payload: {
				productSlug: "monthly",
				providerId: "appleAppStore",
			},
		});
		expect(result).toBe('- Remove appleAppStore config from product "monthly"');
	});

	it("formats delete-perk correctly", () => {
		const result = formatChange({
			changeType: "delete-perk",
			key: "all-access",
			payload: { slug: "all-access" },
		});
		expect(result).toBe("- Delete perk: all-access");
	});

	it("formats delete-product correctly", () => {
		const result = formatChange({
			changeType: "delete-product",
			key: "monthly",
			payload: { slug: "monthly" },
		});
		expect(result).toBe("- Delete product: monthly");
	});

	it("returns fallback for unknown change type", () => {
		const result = formatChange({
			changeType: "unknown-type" as never,
			key: "test",
			payload: {},
		} as never);
		expect(result).toBe("? Unknown change type");
	});
});

describe("formatChangeShort", () => {
	it("formats paywall location changes correctly", () => {
		expect(
			formatChangeShort({
				changeType: "create-paywall-location",
				key: "onboarding",
				payload: {
					description: "Shown after onboarding",
					name: "Onboarding",
					slug: "onboarding",
				},
			}),
		).toBe("PaywallLocation: onboarding");

		expect(
			formatChangeShort({
				changeType: "update-paywall-location",
				key: "onboarding",
				payload: {
					description: null,
					name: "Onboarding Updated",
					slug: "onboarding",
				},
			}),
		).toBe("PaywallLocation: onboarding");

		expect(
			formatChangeShort({
				changeType: "archive-paywall-location",
				key: "onboarding",
				payload: { slug: "onboarding" },
			}),
		).toBe("PaywallLocation: onboarding");
	});

	it("formats perk changes correctly", () => {
		expect(
			formatChangeShort({
				changeType: "create-perk",
				key: "all-access",
				payload: { name: "All Access", slug: "all-access" },
			}),
		).toBe("Perk: all-access");

		expect(
			formatChangeShort({
				changeType: "update-perk",
				key: "all-access",
				payload: { name: "All Access", slug: "all-access" },
			}),
		).toBe("Perk: all-access");

		expect(
			formatChangeShort({
				changeType: "delete-perk",
				key: "all-access",
				payload: { slug: "all-access" },
			}),
		).toBe("Perk: all-access");
	});

	it("formats product changes correctly", () => {
		expect(
			formatChangeShort({
				changeType: "create-product",
				key: "monthly",
				payload: { name: "Monthly", slug: "monthly" },
			}),
		).toBe("Product: monthly");

		expect(
			formatChangeShort({
				changeType: "update-product",
				key: "monthly",
				payload: { name: "Monthly", slug: "monthly" },
			}),
		).toBe("Product: monthly");

		expect(
			formatChangeShort({
				changeType: "delete-product",
				key: "monthly",
				payload: { slug: "monthly" },
			}),
		).toBe("Product: monthly");
	});

	it("formats product-perk changes correctly", () => {
		expect(
			formatChangeShort({
				changeType: "create-product-perk",
				key: "monthly:all-access",
				payload: { perkSlug: "all-access", productSlug: "monthly" },
			}),
		).toBe("ProductPerk: monthly:all-access");

		expect(
			formatChangeShort({
				changeType: "delete-product-perk",
				key: "monthly:all-access",
				payload: { perkSlug: "all-access", productSlug: "monthly" },
			}),
		).toBe("ProductPerk: monthly:all-access");
	});

	it("formats provider-product changes correctly", () => {
		expect(
			formatChangeShort({
				changeType: "create-payment-provider-product",
				key: "monthly:appleAppStore",
				payload: {
					configuration: {},
					productSlug: "monthly",
					providerId: "appleAppStore",
				},
			}),
		).toBe("ProviderProduct: monthly:appleAppStore");

		expect(
			formatChangeShort({
				changeType: "update-payment-provider-product",
				key: "monthly:appleAppStore",
				payload: {
					configuration: {},
					productSlug: "monthly",
					providerId: "appleAppStore",
				},
			}),
		).toBe("ProviderProduct: monthly:appleAppStore");

		expect(
			formatChangeShort({
				changeType: "delete-payment-provider-product",
				key: "monthly:appleAppStore",
				payload: {
					productSlug: "monthly",
					providerId: "appleAppStore",
				},
			}),
		).toBe("ProviderProduct: monthly:appleAppStore");
	});

	it("returns Unknown for unknown change type", () => {
		const result = formatChangeShort({
			changeType: "unknown-type" as never,
			key: "test",
			payload: {},
		} as never);
		expect(result).toBe("Unknown");
	});
});
