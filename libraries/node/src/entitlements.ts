import { Data, Effect } from "effect";

import { VoidhashNodeConfigurationError } from "./errors";
import type { GroupedVoidhashNodeEffectClient } from "./generated/grouped-client";

type EffectSuccess<TEffect> =
  TEffect extends Effect.Effect<infer Success, infer _Error, infer _Requirements> ? Success : never;

type EffectError<TEffect> =
  TEffect extends Effect.Effect<infer _Success, infer Error, infer _Requirements> ? Error : never;

/** The generated groups the convenience namespace is layered on top of. */
type EntitlementsSource = Pick<GroupedVoidhashNodeEffectClient, "perks" | "persons">;

type GetPersonEntitlementsEffect = ReturnType<
  EntitlementsSource["persons"]["getPersonEntitlements"]
>;

type ListPersonsEffect = ReturnType<EntitlementsSource["persons"]["listPersons"]>;

type ListPerksEffect = ReturnType<EntitlementsSource["perks"]["listPerks"]>;

/**
 * `_tag` of the decoded 404 body returned when no person matches the lookup.
 * `hasActivePerk` maps it to `false` instead of failing.
 */
const PERSON_NOT_FOUND_TAG = "ApiPersonNotFoundErrorJsonEncoding";

/**
 * Raised when the distinct-id lookup matches no person.
 *
 * The lookup runs through `persons.listPersons`, which answers `200` with an
 * empty page rather than the `404` the API used to return here, so the SDK
 * raises this failure itself. `_tag` and `data` deliberately mirror the
 * generated client's decoded-404 wrapper so callers that branch on either one
 * keep working.
 */
export class VoidhashPersonNotFoundError extends Data.TaggedError(PERSON_NOT_FOUND_TAG)<{
  readonly data: { readonly _tag: "Api/PersonNotFoundError"; readonly id: string };
}> {}

type GetGrantsError =
  | EffectError<ListPersonsEffect>
  | EffectError<GetPersonEntitlementsEffect>
  | VoidhashPersonNotFoundError;

type ListPerksError = EffectError<ListPerksEffect>;

type HasActivePerkError =
  | Exclude<GetGrantsError | ListPerksError, { readonly _tag: typeof PERSON_NOT_FOUND_TAG }>
  | VoidhashNodeConfigurationError;

/** A single entitlement grant as returned by `persons.getPersonEntitlements`. */
export type VoidhashEntitlementGrant = EffectSuccess<GetPersonEntitlementsEffect>["grants"][number];

export type GetGrantsByDistinctIdRequest = {
  readonly distinctId: string;
};

/**
 * Exactly one of `perkId` / `perkSlug` must be set; supplying both or neither
 * is a configuration error rather than a silent `false`.
 */
export type HasActivePerkRequest = {
  readonly distinctId: string;
  readonly perkId?: string | undefined;
  readonly perkSlug?: string | undefined;
};

export interface VoidhashEntitlementsEffectNamespace {
  /**
   * Resolves the person by distinct id and returns their entitlement grants.
   *
   * An unknown `distinctId` fails with the API's `Api/PersonNotFoundError` so
   * callers can tell "no such person" apart from "person without grants" — use
   * {@link VoidhashEntitlementsEffectNamespace.hasActivePerk} when that
   * distinction does not matter.
   */
  readonly getGrantsByDistinctId: (
    request: GetGrantsByDistinctIdRequest,
  ) => Effect.Effect<ReadonlyArray<VoidhashEntitlementGrant>, GetGrantsError>;

  /**
   * Reports whether the person currently holds an active grant for a perk,
   * selected either by `perkId` or by `perkSlug` (resolved by paging through
   * `perks.listPerks`).
   *
   * An unknown `distinctId` — and an unknown `perkSlug` — resolve to `false`:
   * a person Voidhash has never seen has no access. Authentication and
   * permission failures (`Api/NotAuthenticatedError`,
   * `Api/ActionForbiddenError`), server errors and transport errors still
   * fail, so a broken secret key is never mistaken for "no access".
   */
  readonly hasActivePerk: (
    request: HasActivePerkRequest,
  ) => Effect.Effect<boolean, HasActivePerkError>;
}

const trimmed = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return undefined;
  }

  return trimmedValue;
};

/**
 * Walks the paginated perk catalogue until a perk carries `perkSlug`, yielding
 * `undefined` when no page holds one.
 */
const findPerkIdBySlug = (
  client: EntitlementsSource,
  perkSlug: string,
  cursor: string | undefined,
): Effect.Effect<string | undefined, ListPerksError> =>
  Effect.gen(function* () {
    const page = yield* client.perks.listPerks({
      params: {
        cursor,
        limit: undefined,
        projectId: undefined,
      },
    });
    const match = page.data.find((perk) => perk.slug === perkSlug);

    if (match !== undefined) {
      return match.id;
    }

    if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) {
      return undefined;
    }

    return yield* findPerkIdBySlug(client, perkSlug, page.pageInfo.endCursor);
  });

/**
 * Narrows the request down to a single perk id. Fails when the request does not
 * carry exactly one selector, and yields `undefined` when a `perkSlug` matches
 * no perk in the project.
 */
const resolvePerkId = (
  client: EntitlementsSource,
  request: HasActivePerkRequest,
): Effect.Effect<string | undefined, VoidhashNodeConfigurationError | ListPerksError> => {
  const perkId = trimmed(request.perkId);
  const perkSlug = trimmed(request.perkSlug);

  if ((perkId === undefined) === (perkSlug === undefined)) {
    return Effect.fail(
      new VoidhashNodeConfigurationError(
        "hasActivePerk requires exactly one of perkId or perkSlug.",
      ),
    );
  }

  if (perkSlug !== undefined) {
    return findPerkIdBySlug(client, perkSlug, undefined);
  }

  return Effect.succeed(perkId);
};

/**
 * Builds the `entitlements` namespace over the generated `persons` and `perks`
 * groups. It stays Effect-returning so the Promise client derives its own
 * surface from this one.
 */
export const makeEntitlements = (
  client: EntitlementsSource,
): VoidhashEntitlementsEffectNamespace => {
  const getGrants = (distinctId: string) =>
    Effect.gen(function* () {
      const persons = yield* client.persons.listPersons({
        params: {
          cursor: undefined,
          limit: undefined,
          distinctId,
          email: undefined,
          projectId: undefined,
        },
      });
      const [person] = persons.data;

      if (person === undefined) {
        return yield* Effect.fail(
          new VoidhashPersonNotFoundError({
            data: { _tag: "Api/PersonNotFoundError", id: distinctId },
          }),
        );
      }

      const entitlements = yield* client.persons.getPersonEntitlements({
        params: { personId: person.personId },
      });

      return entitlements.grants;
    });

  return {
    getGrantsByDistinctId: (request) => getGrants(request.distinctId),
    hasActivePerk: (request) =>
      Effect.gen(function* () {
        const perkId = yield* resolvePerkId(client, request);

        if (perkId === undefined) {
          return false;
        }

        const grants = yield* getGrants(request.distinctId);

        return grants.some((grant) => grant.perkId === perkId && grant.status === "active");
      }).pipe(Effect.catchTag(PERSON_NOT_FOUND_TAG, () => Effect.succeed(false))),
  };
};
