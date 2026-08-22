import {
  Person,
  PersonEntitlementsResponse,
  SdkEntitlementGrant,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPersonNotFoundError,
  ApiPersonServiceError,
} from "@voidhash/api-contracts/errors";
import type { SdkPersonSnapshotGrant } from "@voidhash/core/domain/sdkPerson/SdkPerson";
import { PerkGrantService, PersonService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { PersonOrigin } from "@voidhash/db";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

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
    return handlers
      .handle("createPerson", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* personService.createPerson({
              distinctId: payload.distinctId,
              email: payload.email ?? null,
              name: payload.name ?? null,
              projectId,
              origin: PersonOrigin.API,
            });
          }),
        ).pipe(
          Effect.map((person) => toApiPerson(person!)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listPersons", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* personService
              .getPersons({ projectId })
              .pipe(
                Effect.map((persons) =>
                  (persons ?? []).flatMap((person) => {
                    if (!person) return [];
                    return [toApiPerson(person)];
                  }),
                ),
              );
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
          personService.getPersonById(personId).pipe(Effect.map((person) => toApiPerson(person!))),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getPersonByDistinctId", ({ params: { distinctId } }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* personService
              .getPersonByDistinctId(distinctId, projectId)
              .pipe(Effect.map((person) => toApiPerson(person!)));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("setPersonAttributes", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* personService.setPersonAttributes({
              distinctId: payload.distinctId,
              email: payload.email,
              name: payload.name,
              origin: PersonOrigin.API,
              projectId,
              setOnce: payload.setOnce,
              traits: payload.traits,
            });
          }),
        ).pipe(
          Effect.map((person) => toApiPerson(person)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getPersonEntitlements", ({ params: { personId } }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
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
            PerkGrantServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
            PersonNotFoundError: (e) => Effect.fail(new ApiPersonNotFoundError({ id: e.id })),
            PersonServiceError: (e) => Effect.fail(new ApiPersonServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
