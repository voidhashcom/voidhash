import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { VoidhashNodeConfigurationError } from "./errors";
import type { GeneratedVoidhashNodeEffectClient } from "./internal/make-generated-client";

type EffectSuccess<TEffect> =
  TEffect extends Effect.Effect<infer Success, infer _Error, infer _Requirements> ? Success : never;

type EffectError<TEffect> =
  TEffect extends Effect.Effect<infer _Success, infer Error, infer _Requirements> ? Error : never;

/** The generated groups the convenience namespace is layered on top of. */
type EntitlementsSource = Pick<GeneratedVoidhashNodeEffectClient, "perks" | "persons">;

type ListEntitlementsEffect = ReturnType<EntitlementsSource["persons"]["listEntitlements"]>;

type ListPersonsEffect = ReturnType<EntitlementsSource["persons"]["list"]>;

type ListPerksEffect = ReturnType<EntitlementsSource["perks"]["list"]>;

/** `code` of the `not_found` error an unknown or erased person answers with. */
const PERSON_NOT_FOUND_CODE = "person_not_found";

/**
 * Raised when the distinct-id lookup matches no person.
 *
 * The lookup runs through `persons.list`, which answers `200` with an empty
 * page rather than a `404`, so the SDK raises this failure itself. `_tag` and
 * `data` deliberately mirror the generated client's `not_found` error, so
 * callers that branch on `_tag` or on `data.error.code` handle both alike.
 */
export class VoidhashPersonNotFoundError extends Schema.TaggedError<VoidhashPersonNotFoundError>()(
  "NotFoundErrorJsonEncoding",
  {
    data: Schema.Struct({
      error: Schema.Struct({
        type: Schema.Literal("not_found"),
        code: Schema.Literal(PERSON_NOT_FOUND_CODE),
        message: Schema.String,
        param: Schema.Literal("distinctId"),
      }),
    }),
  },
) {}

type GetGrantsError =
  | EffectError<ListPersonsEffect | ListEntitlementsEffect>
  | VoidhashPersonNotFoundError;

type ListPerksError = EffectError<ListPerksEffect>;

type HasActivePerkError = GetGrantsError | ListPerksError | VoidhashNodeConfigurationError;

/** A perk the person can use now, as listed by `persons.listEntitlements`. */
export type VoidhashEntitlementGrant = EffectSuccess<ListEntitlementsEffect>["data"][number];

export type GetGrantsByDistinctIdRequest = {
  readonly distinctId: string;
};

/**
 * Exactly one of `perkId` / `perkSlug` must be set; supplying both or neither
 * is a configuration error rather than a silent `false`.
 */
export type HasActivePerkRequest = {
  readonly distinctId: string;
  readonly perkId?: string;
  readonly perkSlug?: string;
};

export interface VoidhashEntitlementsEffectNamespace {
  /**
   * Resolves the person by distinct id and returns every perk they can use
   * now, walking all pages of `persons.listEntitlements`.
   *
   * An unknown `distinctId` fails with a `not_found` error whose code is
   * `person_not_found`, so callers can tell "no such person" apart from
   * "person without grants" — use
   * {@link VoidhashEntitlementsEffectNamespace.hasActivePerk} when that
   * distinction does not matter.
   */
  readonly getGrantsByDistinctId: (
    request: GetGrantsByDistinctIdRequest,
  ) => Effect.Effect<ReadonlyArray<VoidhashEntitlementGrant>, GetGrantsError>;

  /**
   * Reports whether the person can currently use a perk, selected either by
   * `perkId` or by `perkSlug` (looked up with `perks.list`).
   *
   * An unknown `distinctId` — and an unknown `perkSlug` — resolve to `false`:
   * a person Voidhash has never seen has no access. Authentication and
   * permission failures (`unauthenticated`, `permission_denied`), server
   * errors and transport errors still fail, so a broken secret key is never
   * mistaken for "no access".
   */
  readonly hasActivePerk: (
    request: HasActivePerkRequest,
  ) => Effect.Effect<boolean, HasActivePerkError>;
}

const trimmed = (value?: string): Option.Option<string> => {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || Str.isEmpty(trimmedValue)) {
    return Option.none();
  }

  return Option.some(trimmedValue);
};

/**
 * Narrows the request down to a single perk id. Fails when the request does not
 * carry exactly one selector, and yields none when a `perkSlug` matches no perk
 * in the project.
 */
const resolvePerkId = (
  client: EntitlementsSource,
  request: HasActivePerkRequest,
): Effect.Effect<Option.Option<string>, VoidhashNodeConfigurationError | ListPerksError> => {
  const perkId = trimmed(request.perkId);
  const perkSlug = trimmed(request.perkSlug);

  if (Option.isNone(perkId) === Option.isNone(perkSlug)) {
    return Effect.fail(
      new VoidhashNodeConfigurationError(
        "hasActivePerk requires exactly one of perkId or perkSlug.",
      ),
    );
  }

  if (Option.isSome(perkSlug)) {
    return Effect.map(client.perks.list({ params: { slug: perkSlug.value } }), (page) =>
      Option.map(Option.fromUndefinedOr(page.data[0]), (perk) => perk.id),
    );
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
  const grantsFrom = (
    personId: string,
    cursor: Option.Option<string>,
  ): Effect.Effect<ReadonlyArray<VoidhashEntitlementGrant>, EffectError<ListEntitlementsEffect>> =>
    Effect.gen(function* () {
      const page = yield* client.persons.listEntitlements({
        params: { personId, cursor: Option.getOrUndefined(cursor) },
      });

      if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) {
        return page.data;
      }

      const rest = yield* grantsFrom(personId, Option.some(page.pageInfo.endCursor));
      return [...page.data, ...rest];
    });

  const getGrants = (distinctId: string) =>
    Effect.gen(function* () {
      const persons = yield* client.persons.list({ params: { distinctId } });
      const [person] = persons.data;

      if (person === undefined) {
        return yield* Effect.fail(
          new VoidhashPersonNotFoundError({
            data: {
              error: {
                type: "not_found",
                code: PERSON_NOT_FOUND_CODE,
                message: `This project has no person with distinct id ${distinctId}.`,
                param: "distinctId",
              },
            },
          }),
        );
      }

      return yield* grantsFrom(person.id, Option.none());
    });

  return {
    getGrantsByDistinctId: (request) => getGrants(request.distinctId),
    hasActivePerk: (request) =>
      Effect.gen(function* () {
        const perkId = yield* resolvePerkId(client, request);

        if (Option.isNone(perkId)) {
          return false;
        }

        const grants = yield* getGrants(request.distinctId);

        return grants.some((grant) => grant.perkId === perkId.value);
      }).pipe(
        // Only an unknown person means "no access"; any other `not_found`,
        // such as an unknown project, is a configuration problem and fails.
        Effect.catchTag("NotFoundErrorJsonEncoding", (error) =>
          error.data.error.code === PERSON_NOT_FOUND_CODE
            ? Effect.succeed(false)
            : Effect.fail(error),
        ),
      ),
  };
};
