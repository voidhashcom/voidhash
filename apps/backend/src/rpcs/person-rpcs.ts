import { PersonService } from "@voidhash/core/services";
import { PersonOrigin } from "@voidhash/db";
import {
  Person,
  PersonRpcsDef,
  RpcActionForbiddenError,
  RpcPersonNotFoundError,
  RpcPersonServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

const toRpcPerson = (person: {
  createdAt: Date | null;
  personId: string;
  distinctId: string;
  email: string | null;
  kind: number;
  name: string | null;
}) =>
  ({
    createdAt: person.createdAt,
    personId: person.personId,
    distinctId: person.distinctId,
    email: person.email,
    name: person.name,
    type: person.kind,
  }) satisfies typeof Person.Type;

export const PersonRpcsLive = PersonRpcsDef.toLayer(
  Effect.gen(function* PersonRpcsLive() {
    const personService = yield* PersonService;
    return {
      CreatePerson: ({ distinctId, name, email, projectId }) =>
        personService
          .createPerson({
            distinctId,
            email: email ?? null,
            name: name ?? null,
            origin: PersonOrigin.API,
            projectId,
          })
          .pipe(
            Effect.map(toRpcPerson),
            Effect.catchTags({
              PersonServiceError: (error) =>
                Effect.fail(new RpcPersonServiceError({ cause: error.cause })),
            }),
          ),
      GetPersonByDistinctId: ({ distinctId, projectId }) =>
        personService.getPersonByDistinctId(distinctId, projectId).pipe(
          Effect.map(toRpcPerson),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PersonNotFoundError: (error) =>
              Effect.fail(new RpcPersonNotFoundError({ id: error.id })),
            PersonServiceError: (error) =>
              Effect.fail(new RpcPersonServiceError({ cause: error.cause })),
          }),
        ),
      GetPersonById: ({ personId }) =>
        personService.getPersonById(personId).pipe(
          Effect.map(toRpcPerson),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PersonNotFoundError: (error) =>
              Effect.fail(new RpcPersonNotFoundError({ id: error.id })),
            PersonServiceError: (error) =>
              Effect.fail(new RpcPersonServiceError({ cause: error.cause })),
          }),
        ),
      ListPersons: ({ projectId }) =>
        personService.getPersons({ projectId }).pipe(
          Effect.map((persons) =>
            persons.flatMap((person) => (person ? [toRpcPerson(person)] : [])),
          ),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PersonServiceError: (error) =>
              Effect.fail(new RpcPersonServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
