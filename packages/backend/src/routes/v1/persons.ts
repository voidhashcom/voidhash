import {
  createdResponse,
  Person,
  PersonEntitlementsResponse,
  SdkEntitlementGrant,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPerkGrantServiceError,
  ApiPersonNotFoundError,
  ApiPersonServiceError,
} from "@voidhash/api-contracts/errors";
import type { PersonProfile } from "@voidhash/core/domain/person/Person";
import type { SdkPersonSnapshotGrant } from "@voidhash/core/domain/sdkPerson/SdkPerson";
import { PerkGrantService, PersonService } from "@voidhash/core/services";
import {
  decodeCursor,
  encodeCursor,
  paginate,
  resolveRequestProjectId,
} from "@voidhash/core/utils";
import { PersonOrigin } from "@voidhash/db";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Credentials allowed on the management surface — never a publishable key. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

const toApiPerson = (person: {
  personId: string;
  distinctId: string;
  email: string | null;
  name: string | null;
}) =>
  new Person({
    personId: person.personId,
    distinctId: person.distinctId,
    email: person.email,
    name: person.name,
  });

/** Resolves an optional opaque cursor to the `personId` it points at. */
const toAfterPersonId = (cursor: string | undefined) => {
  if (cursor === undefined) return Effect.succeed(undefined);
  return decodeCursor(cursor);
};

/** Wraps a keyset anchor id back into the public opaque cursor form. */
const toEndCursor = (personId: string | null): string | null => {
  if (personId === null) return null;
  return encodeCursor(personId);
};

const toApiEntitlementGrant = (grant: SdkPersonSnapshotGrant) =>
  new SdkEntitlementGrant({
    expiresAt: grant.expiresAt,
    perkId: grant.perkId,
    source: grant.source,
    sourceId: grant.sourceId,
    sourcePersonId: grant.sourcePersonId,
    status: grant.status,
  });

export const PersonsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "persons", (handlers) =>
  Effect.gen(function* () {
    const perkGrantService = yield* PerkGrantService;
    const personService = yield* PersonService;

    const loadProfileByDistinctId = (projectId: string, distinctId: string) =>
      personService.getPersonByDistinctId(distinctId, projectId).pipe(
        Effect.map((person) => {
          if (!person) return [];
          return [person];
        }),
        Effect.catchTag("PersonNotFoundError", () =>
          Effect.succeed<ReadonlyArray<PersonProfile>>([]),
        ),
      );

    return handlers
      .handle("createPerson", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const person = yield* personService.createPerson({
              distinctId: payload.distinctId,
              email: payload.email ?? null,
              name: payload.name ?? null,
              projectId,
              origin: PersonOrigin.API,
            });
            const created = toApiPerson(person!);
            return yield* createdResponse(Person, created, `/persons/${created.personId}`);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listPersons", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);

            // A distinct id identifies at most one person, so the filter is
            // served by the indexed lookup rather than by a keyset walk over
            // the project. An unknown distinct id is an empty page, not a
            // 404 — a filter that matches nothing is not a missing resource.
            if (query.distinctId !== undefined) {
              const profiles = yield* loadProfileByDistinctId(projectId, query.distinctId);
              const email = query.email?.toLowerCase();
              const matched = profiles.flatMap((profile) => {
                if (email !== undefined && profile.email?.toLowerCase() !== email) return [];
                return [profile];
              });
              const page = yield* paginate(matched, (profile) => profile.personId, {
                cursor: query.cursor,
                limit: query.limit,
              });
              return { data: page.data.map(toApiPerson), pageInfo: page.pageInfo };
            }

            // Persons is the highest-cardinality collection in the product, so
            // the unfiltered listing pages with a keyset read instead of
            // materialising the whole project.
            const after = yield* toAfterPersonId(query.cursor);
            const page = yield* personService.getPersonsPage({
              after,
              email: query.email,
              limit: query.limit,
              projectId,
            });
            return {
              data: page.profiles.map(toApiPerson),
              pageInfo: {
                endCursor: toEndCursor(page.endCursorId),
                hasNextPage: page.hasNextPage,
              },
            };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getPersonById", ({ params: { personId } }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            return yield* personService.getPersonById(personId);
          }),
        ).pipe(
          Effect.map((person) => toApiPerson(person!)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updatePerson", ({ params: { personId }, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            // `setPersonAttributes` keys on `(projectId, distinctId)`, so the
            // path id is resolved to a canonical person first. That read also
            // supplies the project, which is why this route takes no
            // `projectId`: the row already names one.
            const person = yield* personService.getPersonById(personId);
            return yield* personService.setPersonAttributes({
              distinctId: person!.distinctId,
              email: payload.email,
              name: payload.name,
              origin: PersonOrigin.API,
              projectId: person!.projectId,
              setOnce: payload.setOnce,
              traits: payload.traits,
            });
          }),
        ).pipe(
          Effect.map((person) => toApiPerson(person)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getPersonEntitlements", ({ params: { personId } }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            // `getPersonById` resolves merge chains and applies the same
            // not-found / forbidden scoping as the sibling person reads, so the
            // grants below are always loaded for the canonical person.
            const person = yield* personService.getPersonById(personId);
            const grants = yield* perkGrantService.getPersonEntitlementGrants(person!.personId);
            return new PersonEntitlementsResponse({ grants: grants.map(toApiEntitlementGrant) });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkGrantServiceError: (e) =>
              Effect.fail(new ApiPerkGrantServiceError({ cause: e.cause })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
