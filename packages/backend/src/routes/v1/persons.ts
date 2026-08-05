import { Person, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPersonNotFoundError,
  ApiPersonServiceError,
} from "@voidhash/api-contracts/errors";
import { PersonService } from "@voidhash/core/services";
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

export const PersonsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "persons", (handlers) =>
  Effect.gen(function* () {
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
                  (persons ?? []).flatMap((person) => (person ? [toApiPerson(person)] : [])),
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
      );
  }),
);
