import type { SdkEntitlementGrantJsonEncoding, SdkPerson } from "@voidhash/generated-clients";

/** A single active entitlement grant from the person snapshot. */
export type EntitlementGrant = SdkEntitlementGrantJsonEncoding;

/**
 * Finds the active grant for a perk in a person snapshot. `null` when the
 * person has no snapshot or no active grant for the perk — both mean "no
 * access".
 */
export const findActiveGrant = (
  person: SdkPerson | null,
  perkSlug: string,
): EntitlementGrant | null =>
  person?.entitlements.grants.find(
    (grant) => grant.perkId === perkSlug && grant.status === "active",
  ) ?? null;
