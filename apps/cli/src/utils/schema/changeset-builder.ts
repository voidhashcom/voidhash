import type { ChangesetSchema } from "@voidhash/shared";

import type { NormalizedProduct } from "../../domain/schema/normalized-schema";
import type { SchemaDiff } from "./diff";

// ========================================================
// Types
// ========================================================

// Re-export the Change type from the changeset
type Change = (typeof ChangesetSchema.Type)["changes"][number];
type Changeset = typeof ChangesetSchema.Type;

// ========================================================
// Changeset Builder
// ========================================================

/**
 * Build a changeset from a schema diff.
 * Only includes creates and updates, NOT deletes.
 * 
 * Order:
 * 1. Create locations
 * 2. Update locations
 * 3. Create perks
 * 4. Update perks
 * 5. Create products
 * 6. Update products
 * 7. Create product-perks (for new products)
 * 8. Create payment-provider-products (for new products)
 * 9. Update payment-provider-products (for updated products)
 * 10. Archive locations
 */
export function buildChangeset(diff: SchemaDiff): Changeset {
  const changes: Change[] = [];

  // 1. Create locations
  for (const location of diff.locations.toCreate) {
    changes.push({
      changeType: "create-paywall-location",
      key: location.slug,
      payload: {
        description: location.description,
        name: location.name,
        slug: location.slug,
      },
    });
  }

  // 2. Update locations
  for (const { local } of diff.locations.toUpdate) {
    changes.push({
      changeType: "update-paywall-location",
      key: local.slug,
      payload: {
        description: local.description,
        name: local.name,
        slug: local.slug,
      },
    });
  }

  // 3. Create perks (first, as products depend on them)
  for (const perk of diff.perks.toCreate) {
    changes.push({
      changeType: "create-perk",
      key: perk.slug,
      payload: { name: perk.name, slug: perk.slug },
    });
  }

  // 4. Update perks
  for (const { local } of diff.perks.toUpdate) {
    changes.push({
      changeType: "update-perk",
      key: local.slug,
      payload: { name: local.name, slug: local.slug },
    });
  }

  // 5. Create products
  for (const product of diff.products.toCreate) {
    changes.push({
      changeType: "create-product",
      key: product.slug,
      payload: { name: product.name, slug: product.slug },
    });

    // 3a. Create product-perks for this product
    for (const perkSlug of product.perks) {
      changes.push({
        changeType: "create-product-perk",
        key: `${product.slug}:${perkSlug}`,
        payload: { perkSlug, productSlug: product.slug },
      });
    }

    // 3b. Create payment-provider-products for this product
    for (const provider of product.providers) {
      changes.push({
        changeType: "create-payment-provider-product",
        key: `${product.slug}:${provider.providerId}`,
        payload: {
          configuration: provider.configuration as Record<string, unknown>,
          productSlug: product.slug,
          providerId: provider.providerId,
        },
      });
    }
  }

  // 6. Update products
  for (const { local, remote } of diff.products.toUpdate) {
    // Check if product name changed
    if (local.name !== remote.name) {
      changes.push({
        changeType: "update-product",
        key: local.slug,
        payload: { name: local.name, slug: local.slug },
      });
    }

    // Handle product-perk changes
    const localPerkSet = new Set(local.perks);
    const remotePerkSet = new Set(remote.perks);

    // Add new perks
    for (const perkSlug of local.perks) {
      if (!remotePerkSet.has(perkSlug)) {
        changes.push({
          changeType: "create-product-perk",
          key: `${local.slug}:${perkSlug}`,
          payload: { perkSlug, productSlug: local.slug },
        });
      }
    }

    // Note: We don't delete product-perks here (no deletes in push)

    // Handle payment-provider-product changes
    const localProviderMap = new Map(
      local.providers.map((p) => [p.providerId, p])
    );
    const remoteProviderMap = new Map(
      remote.providers.map((p) => [p.providerId, p])
    );

    for (const [providerId, localProvider] of localProviderMap) {
      const remoteProvider = remoteProviderMap.get(providerId);

      if (!remoteProvider) {
        // New provider configuration
        changes.push({
          changeType: "create-payment-provider-product",
          key: `${local.slug}:${providerId}`,
          payload: {
            configuration: localProvider.configuration as Record<string, unknown>,
            productSlug: local.slug,
            providerId,
          },
        });
      } else if (
        JSON.stringify(localProvider.configuration) !==
        JSON.stringify(remoteProvider.configuration)
      ) {
        // Updated provider configuration
        changes.push({
          changeType: "update-payment-provider-product",
          key: `${local.slug}:${providerId}`,
          payload: {
            configuration: localProvider.configuration as Record<string, unknown>,
            productSlug: local.slug,
            providerId,
          },
        });
      }
    }

    // Note: We don't delete payment-provider-products here (no deletes in push)
  }

  // 10. Archive locations
  for (const location of diff.locations.toArchive) {
    changes.push({
      changeType: "archive-paywall-location",
      key: location.slug,
      payload: { slug: location.slug },
    });
  }

  return { changes };
}

// ========================================================
// Change Formatting
// ========================================================

export function formatChange(change: Change): string {
  switch (change.changeType) {
    case "create-paywall-location":
      return `+ Create paywall location: ${change.payload.slug} ("${change.payload.name}")`;
    case "update-paywall-location":
      return `~ Update paywall location: ${change.payload.slug} ("${change.payload.name}")`;
    case "archive-paywall-location":
      return `- Archive paywall location: ${change.payload.slug}`;
    case "create-perk":
      return `+ Create perk: ${change.payload.slug} ("${change.payload.name}")`;
    case "update-perk":
      return `~ Update perk: ${change.payload.slug} ("${change.payload.name}")`;
    case "create-product":
      return `+ Create product: ${change.payload.slug} ("${change.payload.name}")`;
    case "update-product":
      return `~ Update product: ${change.payload.slug} ("${change.payload.name}")`;
    case "create-product-perk":
      return `+ Link perk "${change.payload.perkSlug}" to product "${change.payload.productSlug}"`;
    case "delete-product-perk":
      return `- Unlink perk "${change.payload.perkSlug}" from product "${change.payload.productSlug}"`;
    case "create-payment-provider-product":
      return `+ Configure ${change.payload.providerId} for product "${change.payload.productSlug}"`;
    case "update-payment-provider-product":
      return `~ Update ${change.payload.providerId} config for product "${change.payload.productSlug}"`;
    case "delete-payment-provider-product":
      return `- Remove ${change.payload.providerId} config from product "${change.payload.productSlug}"`;
    case "delete-perk":
      return `- Delete perk: ${change.payload.slug}`;
    case "delete-product":
      return `- Delete product: ${change.payload.slug}`;
    default:
      return `? Unknown change type`;
  }
}

export function formatChangeShort(change: Change): string {
  switch (change.changeType) {
    case "create-paywall-location":
    case "update-paywall-location":
    case "archive-paywall-location":
      return `PaywallLocation: ${change.payload.slug}`;
    case "create-perk":
    case "update-perk":
    case "delete-perk":
      return `Perk: ${change.payload.slug}`;
    case "create-product":
    case "update-product":
    case "delete-product":
      return `Product: ${change.payload.slug}`;
    case "create-product-perk":
    case "delete-product-perk":
      return `ProductPerk: ${change.payload.productSlug}:${change.payload.perkSlug}`;
    case "create-payment-provider-product":
    case "update-payment-provider-product":
    case "delete-payment-provider-product":
      return `ProviderProduct: ${change.payload.productSlug}:${change.payload.providerId}`;
    default:
      return "Unknown";
  }
}
