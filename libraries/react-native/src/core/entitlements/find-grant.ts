import type { SdkEntitlementGrantJsonEncoding, SdkPerson } from "@voidhash/generated-clients";
import * as Option from "effect/Option";

/** A single active entitlement grant from the person snapshot. */
export type EntitlementGrant = SdkEntitlementGrantJsonEncoding;

/**
 * Finds the active grant for a perk in a person snapshot. `None` when the
 * person has no snapshot or no active grant for the perk — both mean "no
 * access".
 */
export const findActiveGrant = (
  person: Option.Option<SdkPerson>,
  perkSlug: string,
): Option.Option<EntitlementGrant> =>
  Option.flatMap(person, (snapshot) =>
    Option.fromUndefinedOr(
      snapshot.entitlements.grants.find(
        (grant) => grant.perkId === perkSlug && grant.status === "active",
      ),
    ),
  );
