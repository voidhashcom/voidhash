/**
 * How commands find the end user a person names. A project can hold
 * millions of persons, so they are looked up exactly through the API's
 * filters (id, distinct id, email) rather than listed and searched.
 */
import type { PersonJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { ApiClient } from "../utils/api-client";
import { apiErrorCode, ExitCode, userError } from "../utils/error-formatter";
import { printable } from "../utils/printable";
import { findItem, type ItemKind, requireText } from "./input";

/**
 * Who a person is, as people say it: "Ada <ada@example.com>", or their
 * distinct id. The app's end users chose these, so the text is
 * {@link printable}.
 */
export const personName = (person: PersonJsonEncoding) =>
  printable(
    person.name !== null && person.email !== null
      ? `${person.name} <${person.email}>`
      : (person.name ?? person.email ?? person.distinctId),
  );

export const personKind: ItemKind<PersonJsonEncoding> = {
  noun: "person",
  label: (person) => {
    const name = personName(person);
    const distinctId = printable(person.distinctId);
    return name === distinctId ? distinctId : `${name} (${distinctId})`;
  },
  listCommand: "voidhash-cli person list",
  keys: (person) => [person.distinctId, ...(person.email === null ? [] : [person.email])],
  names: (person) => (person.name === null ? [] : [person.name]),
};

/** How persons are found, for the hint of a miss. */
export const PERSONS_MATCHED_EXACTLY =
  "Persons are found by their exact email, distinct id or id; names and parts of an email cannot be searched. 'voidhash-cli person list' shows the newest.";

const PREFIXED = /^(person_id|distinct_id|email):(.+)$/;

/**
 * The persons `input` names exactly. A prefix (`person_id:`, `distinct_id:`,
 * `email:`) says which it is; without one, a `person_` id is looked up as an
 * id, and every input as a distinct id and, when it has an `@`, as an email.
 * A distinct id can look like an email, so every lookup runs and the matches
 * are merged. `wanted` is the input without its prefix.
 */
export const personsMatching = (projectId: string, input: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const value = input.trim();
    const prefixed = Option.fromNullishOr(PREFIXED.exec(value));
    const kind = Option.flatMap(prefixed, (match) => Option.fromNullishOr(match[1]));
    const wanted = Option.match(
      Option.flatMap(prefixed, (match) => Option.fromNullishOr(match[2])),
      { onNone: () => value, onSome: (rest) => rest.trim() },
    );
    const lookUp = (which: "person_id" | "distinct_id" | "email") =>
      Option.match(kind, { onNone: () => true, onSome: (named) => named === which });

    const [byId, byDistinctId, byEmail] = yield* Effect.all(
      [
        lookUp("person_id") && (Option.isSome(kind) || wanted.startsWith("person_"))
          ? api.personsGet(projectId, wanted).pipe(
              Effect.map(Arr.of),
              Effect.catchIf(
                (error) => Option.contains(apiErrorCode(error), "person_not_found"),
                () => Effect.succeed([]),
              ),
            )
          : Effect.succeed([]),
        lookUp("distinct_id")
          ? api.personsList(projectId, { distinctId: wanted }).pipe(Effect.map(({ data }) => data))
          : Effect.succeed([]),
        lookUp("email") && (Option.isSome(kind) || wanted.includes("@"))
          ? api
              .personsList(projectId, { email: wanted, limit: 20 })
              .pipe(Effect.map(({ data }) => data))
          : Effect.succeed([]),
      ],
      { concurrency: 3 },
    );
    return {
      wanted,
      persons: Arr.dedupeWith([...byId, ...byDistinctId, ...byEmail], (a, b) => a.id === b.id),
    };
  });

/**
 * The one person `input` names (see {@link personsMatching}). Fails with
 * exit 4 when nobody matches and lists the candidates (exit 2) when several
 * do, such as persons sharing an email.
 */
export const findPerson = (projectId: string, input: string) =>
  Effect.gen(function* () {
    const { wanted, persons } = yield* personsMatching(projectId, input);
    const [only, ...others] = persons;
    if (only === undefined) {
      return yield* Effect.fail(
        userError(`No person has the email, distinct id or id "${input.trim()}".`, {
          hint: PERSONS_MATCHED_EXACTLY,
          exitCode: ExitCode.notFound,
        }),
      );
    }
    // An id or distinct id names one person; findItem lists the candidates of a shared email.
    return Arr.isReadonlyArrayEmpty(others) ? only : yield* findItem(personKind, persons, wanted);
  });

/** The person a command's argument names, asked for on a terminal (see {@link findPerson}). */
export const requirePerson = (projectId: string, input: Option.Option<string>, usage: string) =>
  Effect.flatMap(
    requireText(input, {
      flag: "the person",
      message: "Their email, distinct id or id",
      usage,
    }),
    (query) => findPerson(projectId, query),
  );
