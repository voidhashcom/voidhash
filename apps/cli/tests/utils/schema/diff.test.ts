import { describe, expect, it } from "vitest";

import { computeDiff, summarizeDiff } from "../../../src/utils/schema/diff";
import {
	createProviderConfig,
	createTestPaywallLocation,
	createTestPerk,
	createTestProduct,
	createTestSchema,
} from "../../helpers/schema-factories";

describe("computeDiff", () => {
	describe("locations", () => {
		it("returns empty diff for identical locations", () => {
			const location = createTestPaywallLocation({
				slug: "onboarding",
				name: "Onboarding",
			});
			const local = createTestSchema({ locations: [location] });
			const remote = createTestSchema({ locations: [location] });

			const diff = computeDiff(local, remote);

			expect(diff.locations.toCreate).toHaveLength(0);
			expect(diff.locations.toUpdate).toHaveLength(0);
			expect(diff.locations.remoteOnly).toHaveLength(0);
			expect(diff.locations.toArchive).toHaveLength(0);
		});

		it("identifies locations to create (local only)", () => {
			const localLocation = createTestPaywallLocation({
				slug: "onboarding",
				name: "Onboarding",
			});
			const local = createTestSchema({ locations: [localLocation] });
			const remote = createTestSchema({ locations: [] });

			const diff = computeDiff(local, remote);

			expect(diff.locations.toCreate).toHaveLength(1);
			expect(diff.locations.toCreate[0]).toEqual(localLocation);
			expect(diff.locations.toUpdate).toHaveLength(0);
			expect(diff.locations.remoteOnly).toHaveLength(0);
			expect(diff.locations.toArchive).toHaveLength(0);
		});

		it("identifies locations to update (same slug, different metadata)", () => {
			const localLocation = createTestPaywallLocation({
				description: null,
				slug: "onboarding",
				name: "Onboarding New",
			});
			const remoteLocation = createTestPaywallLocation({
				description: "Shown after launch",
				slug: "onboarding",
				name: "Onboarding Old",
			});
			const local = createTestSchema({ locations: [localLocation] });
			const remote = createTestSchema({ locations: [remoteLocation] });

			const diff = computeDiff(local, remote);

			expect(diff.locations.toCreate).toHaveLength(0);
			expect(diff.locations.toUpdate).toHaveLength(1);
			expect(diff.locations.toUpdate[0]).toEqual({
				local: localLocation,
				remote: remoteLocation,
			});
		});

		it("identifies remote-only locations to archive", () => {
			const remoteLocation = createTestPaywallLocation({
				slug: "onboarding",
				name: "Onboarding",
			});
			const local = createTestSchema({ locations: [] });
			const remote = createTestSchema({ locations: [remoteLocation] });

			const diff = computeDiff(local, remote);

			expect(diff.locations.remoteOnly).toHaveLength(1);
			expect(diff.locations.toArchive).toHaveLength(1);
			expect(diff.locations.toArchive[0]).toEqual(remoteLocation);
		});
	});

	describe("perks", () => {
		it("returns empty diff for identical schemas", () => {
			const perk = createTestPerk({ slug: "perk-1", name: "Perk 1" });
			const local = createTestSchema({ perks: [perk] });
			const remote = createTestSchema({ perks: [perk] });

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(0);
			expect(diff.perks.toUpdate).toHaveLength(0);
			expect(diff.perks.remoteOnly).toHaveLength(0);
		});

		it("identifies perks to create (local only)", () => {
			const localPerk = createTestPerk({ slug: "local-perk", name: "Local" });
			const local = createTestSchema({ perks: [localPerk] });
			const remote = createTestSchema({ perks: [] });

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(1);
			expect(diff.perks.toCreate[0]).toEqual(localPerk);
			expect(diff.perks.toUpdate).toHaveLength(0);
			expect(diff.perks.remoteOnly).toHaveLength(0);
		});

		it("identifies remote-only perks", () => {
			const remotePerk = createTestPerk({
				slug: "remote-perk",
				name: "Remote",
			});
			const local = createTestSchema({ perks: [] });
			const remote = createTestSchema({ perks: [remotePerk] });

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(0);
			expect(diff.perks.toUpdate).toHaveLength(0);
			expect(diff.perks.remoteOnly).toHaveLength(1);
			expect(diff.perks.remoteOnly[0]).toEqual(remotePerk);
		});

		it("identifies perks to update (same slug, different name)", () => {
			const localPerk = createTestPerk({ slug: "perk-1", name: "Updated Name" });
			const remotePerk = createTestPerk({
				slug: "perk-1",
				name: "Original Name",
			});
			const local = createTestSchema({ perks: [localPerk] });
			const remote = createTestSchema({ perks: [remotePerk] });

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(0);
			expect(diff.perks.toUpdate).toHaveLength(1);
			expect(diff.perks.toUpdate[0]).toEqual({
				local: localPerk,
				remote: remotePerk,
			});
			expect(diff.perks.remoteOnly).toHaveLength(0);
		});

		it("handles multiple perks correctly", () => {
			const sharedPerk = createTestPerk({ slug: "shared", name: "Shared" });
			const localOnlyPerk = createTestPerk({
				slug: "local-only",
				name: "Local Only",
			});
			const remoteOnlyPerk = createTestPerk({
				slug: "remote-only",
				name: "Remote Only",
			});
			const localUpdatedPerk = createTestPerk({
				slug: "updated",
				name: "Updated Local",
			});
			const remoteUpdatedPerk = createTestPerk({
				slug: "updated",
				name: "Updated Remote",
			});

			const local = createTestSchema({
				perks: [sharedPerk, localOnlyPerk, localUpdatedPerk],
			});
			const remote = createTestSchema({
				perks: [sharedPerk, remoteOnlyPerk, remoteUpdatedPerk],
			});

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(1);
			expect(diff.perks.toCreate[0]?.slug).toBe("local-only");
			expect(diff.perks.toUpdate).toHaveLength(1);
			expect(diff.perks.toUpdate[0]?.local.slug).toBe("updated");
			expect(diff.perks.remoteOnly).toHaveLength(1);
			expect(diff.perks.remoteOnly[0]?.slug).toBe("remote-only");
		});
	});

	describe("products", () => {
		it("identifies products to create (local only)", () => {
			const localProduct = createTestProduct({
				slug: "local-product",
				name: "Local",
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toCreate).toHaveLength(1);
			expect(diff.products.toCreate[0]).toEqual(localProduct);
			expect(diff.products.toUpdate).toHaveLength(0);
			expect(diff.products.remoteOnly).toHaveLength(0);
		});

		it("identifies remote-only products", () => {
			const remoteProduct = createTestProduct({
				slug: "remote-product",
				name: "Remote",
			});
			const local = createTestSchema({ products: [] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toCreate).toHaveLength(0);
			expect(diff.products.toUpdate).toHaveLength(0);
			expect(diff.products.remoteOnly).toHaveLength(1);
			expect(diff.products.remoteOnly[0]).toEqual(remoteProduct);
		});

		it("identifies products to update when name differs", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Updated Name",
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Original Name",
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toCreate).toHaveLength(0);
			expect(diff.products.toUpdate).toHaveLength(1);
			expect(diff.products.toUpdate[0]).toEqual({
				local: localProduct,
				remote: remoteProduct,
			});
		});

		it("identifies products to update when perks differ", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				perks: ["perk-1", "perk-2"],
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				perks: ["perk-1"],
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toUpdate).toHaveLength(1);
			expect(diff.products.toUpdate[0]?.local.perks).toEqual([
				"perk-1",
				"perk-2",
			]);
			expect(diff.products.toUpdate[0]?.remote.perks).toEqual(["perk-1"]);
		});

		it("identifies products to update when providers differ", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [
					createProviderConfig("appleAppStore", { productId: "com.app.1" }),
				],
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [],
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toUpdate).toHaveLength(1);
		});

		it("identifies products to update when provider config differs", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [
					createProviderConfig("appleAppStore", { productId: "com.app.new" }),
				],
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [
					createProviderConfig("appleAppStore", { productId: "com.app.old" }),
				],
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toUpdate).toHaveLength(1);
		});

		it("handles products with no perks", () => {
			const product = createTestProduct({
				slug: "no-perks",
				name: "No Perks",
				perks: [],
			});
			const local = createTestSchema({ products: [product] });
			const remote = createTestSchema({ products: [product] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toCreate).toHaveLength(0);
			expect(diff.products.toUpdate).toHaveLength(0);
		});

		it("handles products with no providers", () => {
			const product = createTestProduct({
				slug: "no-providers",
				name: "No Providers",
				providers: [],
			});
			const local = createTestSchema({ products: [product] });
			const remote = createTestSchema({ products: [product] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toCreate).toHaveLength(0);
			expect(diff.products.toUpdate).toHaveLength(0);
		});

		it("treats products with same perks in different order as equal", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				perks: ["perk-1", "perk-2"],
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				perks: ["perk-2", "perk-1"],
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toUpdate).toHaveLength(0);
		});

		it("treats products with same providers in different order as equal", () => {
			const localProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [
					createProviderConfig("googlePlay", { productId: "google.1" }),
					createProviderConfig("appleAppStore", { productId: "apple.1" }),
				],
			});
			const remoteProduct = createTestProduct({
				slug: "product-1",
				name: "Product",
				providers: [
					createProviderConfig("appleAppStore", { productId: "apple.1" }),
					createProviderConfig("googlePlay", { productId: "google.1" }),
				],
			});
			const local = createTestSchema({ products: [localProduct] });
			const remote = createTestSchema({ products: [remoteProduct] });

			const diff = computeDiff(local, remote);

			expect(diff.products.toUpdate).toHaveLength(0);
		});
	});

	describe("complex scenarios", () => {
		it("handles mixed creates, updates, and remote-only items", () => {
			const sharedPerk = createTestPerk({ slug: "shared", name: "Shared" });
			const localPerk = createTestPerk({
				slug: "local-perk",
				name: "Local Perk",
			});
			const remotePerk = createTestPerk({
				slug: "remote-perk",
				name: "Remote Perk",
			});

			const sharedProduct = createTestProduct({
				slug: "shared-product",
				name: "Shared",
			});
			const localProduct = createTestProduct({
				slug: "local-product",
				name: "Local",
			});
			const localUpdatedProduct = createTestProduct({
				slug: "updated-product",
				name: "Updated Local",
			});
			const remoteProduct = createTestProduct({
				slug: "remote-product",
				name: "Remote",
			});
			const remoteUpdatedProduct = createTestProduct({
				slug: "updated-product",
				name: "Updated Remote",
			});

			const local = createTestSchema({
				perks: [sharedPerk, localPerk],
				products: [sharedProduct, localProduct, localUpdatedProduct],
			});
			const remote = createTestSchema({
				perks: [sharedPerk, remotePerk],
				products: [sharedProduct, remoteProduct, remoteUpdatedProduct],
			});

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(1);
			expect(diff.perks.remoteOnly).toHaveLength(1);
			expect(diff.products.toCreate).toHaveLength(1);
			expect(diff.products.toUpdate).toHaveLength(1);
			expect(diff.products.remoteOnly).toHaveLength(1);
		});

		it("handles empty local schema against populated remote", () => {
			const remotePerk = createTestPerk({
				slug: "remote-perk",
				name: "Remote",
			});
			const remoteProduct = createTestProduct({
				slug: "remote-product",
				name: "Remote",
			});

			const local = createTestSchema({});
			const remote = createTestSchema({
				perks: [remotePerk],
				products: [remoteProduct],
			});

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(0);
			expect(diff.perks.remoteOnly).toHaveLength(1);
			expect(diff.products.toCreate).toHaveLength(0);
			expect(diff.products.remoteOnly).toHaveLength(1);
		});

		it("handles populated local schema against empty remote", () => {
			const localPerk = createTestPerk({ slug: "local-perk", name: "Local" });
			const localProduct = createTestProduct({
				slug: "local-product",
				name: "Local",
			});

			const local = createTestSchema({
				perks: [localPerk],
				products: [localProduct],
			});
			const remote = createTestSchema({});

			const diff = computeDiff(local, remote);

			expect(diff.perks.toCreate).toHaveLength(1);
			expect(diff.perks.remoteOnly).toHaveLength(0);
			expect(diff.products.toCreate).toHaveLength(1);
			expect(diff.products.remoteOnly).toHaveLength(0);
		});
	});
});

describe("summarizeDiff", () => {
	it("returns zeros for empty diff", () => {
		const local = createTestSchema({});
		const remote = createTestSchema({});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.perksToCreate).toBe(0);
		expect(summary.locationsToCreate).toBe(0);
		expect(summary.locationsToUpdate).toBe(0);
		expect(summary.locationsToArchive).toBe(0);
		expect(summary.locationsRemoteOnly).toBe(0);
		expect(summary.perksToUpdate).toBe(0);
		expect(summary.perksRemoteOnly).toBe(0);
		expect(summary.productsToCreate).toBe(0);
		expect(summary.productsToUpdate).toBe(0);
		expect(summary.productsRemoteOnly).toBe(0);
		expect(summary.totalChanges).toBe(0);
	});

	it("correctly counts perks to create", () => {
		const local = createTestSchema({
			perks: [
				createTestPerk({ slug: "perk-1", name: "Perk 1" }),
				createTestPerk({ slug: "perk-2", name: "Perk 2" }),
			],
		});
		const remote = createTestSchema({});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.perksToCreate).toBe(2);
	});

	it("correctly counts perks to update", () => {
		const local = createTestSchema({
			perks: [createTestPerk({ slug: "perk-1", name: "Updated" })],
		});
		const remote = createTestSchema({
			perks: [createTestPerk({ slug: "perk-1", name: "Original" })],
		});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.perksToUpdate).toBe(1);
	});

	it("correctly counts remote-only perks", () => {
		const local = createTestSchema({});
		const remote = createTestSchema({
			perks: [
				createTestPerk({ slug: "perk-1", name: "Perk 1" }),
				createTestPerk({ slug: "perk-2", name: "Perk 2" }),
				createTestPerk({ slug: "perk-3", name: "Perk 3" }),
			],
		});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.perksRemoteOnly).toBe(3);
	});

	it("correctly counts products to create", () => {
		const local = createTestSchema({
			products: [createTestProduct({ slug: "product-1", name: "Product 1" })],
		});
		const remote = createTestSchema({});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.productsToCreate).toBe(1);
	});

	it("correctly counts products to update", () => {
		const local = createTestSchema({
			products: [createTestProduct({ slug: "product-1", name: "Updated" })],
		});
		const remote = createTestSchema({
			products: [createTestProduct({ slug: "product-1", name: "Original" })],
		});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.productsToUpdate).toBe(1);
	});

	it("correctly counts remote-only products", () => {
		const local = createTestSchema({});
		const remote = createTestSchema({
			products: [
				createTestProduct({ slug: "product-1", name: "Product 1" }),
				createTestProduct({ slug: "product-2", name: "Product 2" }),
			],
		});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		expect(summary.productsRemoteOnly).toBe(2);
	});

	it("totalChanges includes location archive actions derived from remote-only locations", () => {
		const local = createTestSchema({
			locations: [
				createTestPaywallLocation({
					description: null,
					slug: "new-location",
					name: "New Location",
				}),
				createTestPaywallLocation({
					description: null,
					slug: "updated-location",
					name: "Updated Local",
				}),
			],
			perks: [
				createTestPerk({ slug: "new-perk", name: "New" }),
				createTestPerk({ slug: "updated-perk", name: "Updated Local" }),
			],
			products: [
				createTestProduct({ slug: "new-product", name: "New" }),
				createTestProduct({ slug: "updated-product", name: "Updated Local" }),
			],
		});
		const remote = createTestSchema({
			locations: [
				createTestPaywallLocation({
					description: "Old description",
					slug: "updated-location",
					name: "Updated Remote",
				}),
				createTestPaywallLocation({
					slug: "remote-only-location",
					name: "Remote Only",
				}),
			],
			perks: [
				createTestPerk({ slug: "updated-perk", name: "Updated Remote" }),
				createTestPerk({ slug: "remote-only-perk", name: "Remote Only" }),
			],
			products: [
				createTestProduct({ slug: "updated-product", name: "Updated Remote" }),
				createTestProduct({
					slug: "remote-only-product",
					name: "Remote Only",
				}),
			],
		});
		const diff = computeDiff(local, remote);

		const summary = summarizeDiff(diff);

		// 1 location to create + 1 location to update + 1 location to archive +
		// 1 perk to create + 1 perk to update + 1 product to create + 1 product to update = 7
		expect(summary.totalChanges).toBe(7);
		expect(summary.locationsRemoteOnly).toBe(1);
		expect(summary.locationsToArchive).toBe(1);
		expect(summary.perksRemoteOnly).toBe(1);
		expect(summary.productsRemoteOnly).toBe(1);
	});
});
