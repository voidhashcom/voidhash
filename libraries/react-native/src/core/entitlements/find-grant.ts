import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import type { EntitlementGrant, Person } from "../entities/person";

export type { EntitlementGrant };

/**
 * Finds the active grant for a perk in a person snapshot. `None` when the
 * person has no snapshot or no active grant for the perk — both mean "no
 * access".
 *
 * `perkSlug` is the slug configured in Studio, matched against the grant's
 * `perkSlug`. A grant's `perkId` (the perk's internal id) matches too, so a
 * snapshot cached before grants carried a slug, or a check by id, still
 * answers.
 */
export const findActiveGrant = (
  person: Option.Option<Person>,
  perkSlug: string,
): Option.Option<EntitlementGrant> =>
  Option.flatMap(person, (snapshot) =>
    Arr.findFirst(
      snapshot.entitlements.grants,
      (grant) =>
        grant.status === "active" && (grant.perkSlug === perkSlug || grant.perkId === perkSlug),
    ),
  );
