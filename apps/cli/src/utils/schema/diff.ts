import type {
  NormalizedPaywallLocation,
  NormalizedPerk,
  NormalizedProduct,
  NormalizedSchema,
} from "../../domain/schema/normalized-schema";

// ========================================================
// Types
// ========================================================

export interface PerkDiff {
  remoteOnly: NormalizedPerk[];
  toCreate: NormalizedPerk[];
  toUpdate: { local: NormalizedPerk; remote: NormalizedPerk }[];
}

export interface ProductDiff {
  remoteOnly: NormalizedProduct[];
  toCreate: NormalizedProduct[];
  toUpdate: { local: NormalizedProduct; remote: NormalizedProduct }[];
}

export interface PaywallLocationDiff {
  remoteOnly: NormalizedPaywallLocation[];
  toArchive: NormalizedPaywallLocation[];
  toCreate: NormalizedPaywallLocation[];
  toUpdate: { local: NormalizedPaywallLocation; remote: NormalizedPaywallLocation }[];
}

export interface SchemaDiff {
  locations: PaywallLocationDiff;
  perks: PerkDiff;
  products: ProductDiff;
}

// ========================================================
// Comparison Helpers
// ========================================================

function perksEqual(a: NormalizedPerk, b: NormalizedPerk): boolean {
  return a.slug === b.slug && a.name === b.name;
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function providerConfigsEqual(
  a: readonly { providerId: string; configuration: Readonly<Record<string, unknown>> }[],
  b: readonly { providerId: string; configuration: Readonly<Record<string, unknown>> }[]
): boolean {
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort((x, y) => x.providerId.localeCompare(y.providerId));
  const sortedB = [...b].sort((x, y) => x.providerId.localeCompare(y.providerId));

  for (let i = 0; i < sortedA.length; i++) {
    const provA = sortedA[i];
    const provB = sortedB[i];
    if (!provA || !provB) return false;
    if (provA.providerId !== provB.providerId) return false;
    // Deep compare configurations
    if (JSON.stringify(provA.configuration) !== JSON.stringify(provB.configuration)) {
      return false;
    }
  }

  return true;
}

function productsEqual(a: NormalizedProduct, b: NormalizedProduct): boolean {
  return (
    a.slug === b.slug &&
    a.name === b.name &&
    a.type === b.type &&
    arraysEqual(a.perks, b.perks) &&
    providerConfigsEqual(a.providers, b.providers)
  );
}

function locationsEqual(
  a: NormalizedPaywallLocation,
  b: NormalizedPaywallLocation
): boolean {
  return (
    a.slug === b.slug &&
    a.name === b.name &&
    (a.description ?? null) === (b.description ?? null)
  );
}

// ========================================================
// Diff Algorithm
// ========================================================

/**
 * Compute the difference between local and remote schemas.
 * 
 * - toCreate: exists in local but not in remote
 * - toUpdate: exists in both but values differ
 * - remoteOnly: exists in remote but not in local (for info, we don't delete)
 */
export function computeDiff(
  local: NormalizedSchema,
  remote: NormalizedSchema
): SchemaDiff {
  const diff: SchemaDiff = {
    locations: { remoteOnly: [], toArchive: [], toCreate: [], toUpdate: [] },
    perks: { remoteOnly: [], toCreate: [], toUpdate: [] },
    products: { remoteOnly: [], toCreate: [], toUpdate: [] },
  };

  // Compare paywall locations
  for (const [slug, localLocation] of local.locations) {
    const remoteLocation = remote.locations.get(slug);
    if (!remoteLocation) {
      diff.locations.toCreate.push(localLocation);
    } else if (!locationsEqual(localLocation, remoteLocation)) {
      diff.locations.toUpdate.push({ local: localLocation, remote: remoteLocation });
    }
  }

  // Find remote-only locations (active on server, absent locally)
  for (const [slug, remoteLocation] of remote.locations) {
    if (!local.locations.has(slug)) {
      diff.locations.remoteOnly.push(remoteLocation);
      diff.locations.toArchive.push(remoteLocation);
    }
  }

  // Compare perks
  for (const [slug, localPerk] of local.perks) {
    const remotePerk = remote.perks.get(slug);
    if (!remotePerk) {
      diff.perks.toCreate.push(localPerk);
    } else if (!perksEqual(localPerk, remotePerk)) {
      diff.perks.toUpdate.push({ local: localPerk, remote: remotePerk });
    }
  }

  // Find remote-only perks
  for (const [slug, remotePerk] of remote.perks) {
    if (!local.perks.has(slug)) {
      diff.perks.remoteOnly.push(remotePerk);
    }
  }

  // Compare products
  for (const [slug, localProduct] of local.products) {
    const remoteProduct = remote.products.get(slug);
    if (!remoteProduct) {
      diff.products.toCreate.push(localProduct);
    } else if (!productsEqual(localProduct, remoteProduct)) {
      diff.products.toUpdate.push({ local: localProduct, remote: remoteProduct });
    }
  }

  // Find remote-only products
  for (const [slug, remoteProduct] of remote.products) {
    if (!local.products.has(slug)) {
      diff.products.remoteOnly.push(remoteProduct);
    }
  }

  return diff;
}

// ========================================================
// Summary Helpers
// ========================================================

export interface DiffSummary {
  locationsToArchive: number;
  locationsToCreate: number;
  locationsToUpdate: number;
  locationsRemoteOnly: number;
  perksToCreate: number;
  perksToUpdate: number;
  perksRemoteOnly: number;
  productsToCreate: number;
  productsToUpdate: number;
  productsRemoteOnly: number;
  totalChanges: number;
}

export function summarizeDiff(diff: SchemaDiff): DiffSummary {
  const locationsToCreate = diff.locations.toCreate.length;
  const locationsToUpdate = diff.locations.toUpdate.length;
  const locationsToArchive = diff.locations.toArchive.length;
  const locationsRemoteOnly = diff.locations.remoteOnly.length;
  const perksToCreate = diff.perks.toCreate.length;
  const perksToUpdate = diff.perks.toUpdate.length;
  const perksRemoteOnly = diff.perks.remoteOnly.length;
  const productsToCreate = diff.products.toCreate.length;
  const productsToUpdate = diff.products.toUpdate.length;
  const productsRemoteOnly = diff.products.remoteOnly.length;

  return {
    locationsRemoteOnly,
    locationsToArchive,
    locationsToCreate,
    locationsToUpdate,
    perksRemoteOnly,
    perksToCreate,
    perksToUpdate,
    productsRemoteOnly,
    productsToCreate,
    productsToUpdate,
    totalChanges:
      locationsToCreate +
      locationsToUpdate +
      locationsToArchive +
      perksToCreate +
      perksToUpdate +
      productsToCreate +
      productsToUpdate,
  };
}
