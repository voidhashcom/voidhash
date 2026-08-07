import { constant } from "@voidhash/lib/lang";
import { Schema } from "effect";

import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";

/**
 * Identity kind ordering — `Identified` outranks `Anonymous` when picking a
 * person's primary identity. Numeric values mirror the `person_identity.kind`
 * column so the comparator's `right.kind - left.kind` arithmetic stays valid.
 */
export const PersonIdentityKind = constant({
  Anonymous: 1,
  Identified: 2,
});

export type PersonIdentityKindValue = (typeof PersonIdentityKind)[keyof typeof PersonIdentityKind];

export const PersonIdentityKindSchema = Schema.Literals([
  PersonIdentityKind.Anonymous,
  PersonIdentityKind.Identified,
]);

/**
 * Identity of a person — one of the `(distinctId, kind)` pairs that point at
 * a person. A person can have many identities (anonymous and identified)
 * over their lifetime; the highest-`kind`, most-recently-updated one is the
 * "primary" identity used to render the public {@link PersonProfile}.
 */
export class PersonIdentity extends Schema.TaggedClass<PersonIdentity>()("PersonIdentity", {
  id: Schema.String,
  distinctId: Schema.String,
  personId: Schema.String,
  projectId: Schema.String,
  kind: PersonIdentityKindSchema,
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  createdAt: Schema.NullOr(Schema.Date),
  updatedAt: Schema.NullOr(Schema.Date),
}) {
  /**
   * Comparator used to pick the primary identity for a {@link Person}.
   * Ordering: higher kind first, then newer `updatedAt`, then newer
   * `createdAt`, with a lexicographic `distinctId` tie-breaker so the result
   * is deterministic.
   */
  static compareForPrimary(left: PersonIdentity, right: PersonIdentity): number {
    if (left.kind !== right.kind) {
      return right.kind - left.kind;
    }

    const leftUpdatedAt = left.updatedAt?.getTime() ?? 0;
    const rightUpdatedAt = right.updatedAt?.getTime() ?? 0;
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    const leftCreatedAt = left.createdAt?.getTime() ?? 0;
    const rightCreatedAt = right.createdAt?.getTime() ?? 0;
    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    return left.distinctId.localeCompare(right.distinctId);
  }
}

/**
 * Public-facing snapshot of a person and their primary identity. This is the
 * shape returned by `PersonService` — anything outside the `core` package
 * should consume this rather than the raw {@link Person} aggregate.
 */
export class PersonProfile extends Schema.TaggedClass<PersonProfile>()("PersonProfile", {
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  personId: Schema.String,
  distinctId: Schema.String,
  email: Schema.NullOr(Schema.String),
  kind: PersonIdentityKindSchema,
  mergedIntoPersonId: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  projectId: Schema.String,
}) {}

/**
 * Person aggregate — wraps the person fields plus its associated identities
 * so that domain logic (`primaryIdentity`, `toProfile`, `isArchived`,
 * `isMerged`) can reason about a person without reaching back into the
 * database. DB-row mapping lives in the `persons` service.
 */
export class Person extends Schema.TaggedClass<Person>()("Person", {
  id: Schema.String,
  projectId: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  mergedIntoPersonId: Schema.NullOr(Schema.String),
  identities: Schema.Array(PersonIdentity),
}) {
  isArchived(): boolean {
    return this.archivedAt !== null;
  }

  isMerged(): boolean {
    return this.mergedIntoPersonId !== null;
  }

  /**
   * Picks the primary identity using {@link PersonIdentity.compareForPrimary}.
   * Returns `undefined` if the person has no identities yet.
   */
  primaryIdentity(): PersonIdentity | undefined {
    if (this.identities.length === 0) {
      return undefined;
    }
    return [...this.identities].sort((left, right) =>
      PersonIdentity.compareForPrimary(left, right),
    )[0];
  }

  /**
   * Projects the person + primary identity into the public
   * {@link PersonProfile} shape. Returns `undefined` when the person has no
   * identities (which means there is no `distinctId` we can surface to the
   * caller).
   */
  toProfile(): PersonProfile | undefined {
    const primary = this.primaryIdentity();
    if (!primary) {
      return undefined;
    }
    return new PersonProfile({
      archivedAt: this.archivedAt,
      createdAt: this.createdAt,
      personId: this.id,
      distinctId: primary.distinctId,
      email: this.email,
      kind: primary.kind,
      mergedIntoPersonId: this.mergedIntoPersonId,
      name: this.name,
      projectId: this.projectId,
    });
  }
}

/** Person not found in the database. */
export class PersonNotFoundError extends Schema.TaggedErrorClass<PersonNotFoundError>(
  "PersonNotFoundError",
)("PersonNotFoundError", { id: Schema.String }) {}

/** Anonymous ID is invalid (e.g., missing the `vh:anon:` prefix). */
export class PersonInvalidAnonymousIdError extends Schema.TaggedErrorClass<PersonInvalidAnonymousIdError>(
  "PersonInvalidAnonymousIdError",
)("PersonInvalidAnonymousIdError", { id: Schema.String }) {}

/**
 * Versioned snapshot of a person, emitted to the analytics projection whenever
 * the person's profile or merge state changes. Schema-versioned so downstream
 * consumers can evolve independently; `version` is monotonic per person.
 */
export interface PersonSnapshotEventV1 {
  readonly changedAt: string;
  readonly personId: string;
  readonly email?: string;
  readonly isArchived: boolean;
  readonly mergedIntoPersonId?: string;
  readonly name?: string;
  readonly primaryDistinctId?: string;
  readonly projectId: string;
  readonly schemaVersion: 1;
  readonly traits: Record<string, unknown>;
  readonly version: number;
}

/**
 * Versioned `(distinctId → person)` mapping change, emitted to the analytics
 * projection whenever an identity is created or repointed.
 */
export interface PersonIdentityEventV1 {
  readonly changedAt: string;
  readonly personId: string;
  readonly distinctId: string;
  /**
   * When set, this mapping is an identity *override*: events carrying
   * `previousDistinctId` should be re-attributed to `personId`. Set explicitly
   * by the synchronous merge so the override direction does not depend on which
   * side of an identify survives (the older person wins, which may be either the
   * source or the target).
   */
  readonly previousDistinctId?: string;
  readonly isDeleted: boolean;
  readonly kind: PersonIdentityKindValue;
  readonly projectId: string;
  readonly schemaVersion: 1;
  readonly version: number;
}

/**
 * A distinct id is "anonymous" when it carries the reserved
 * {@link ANONYMOUS_USER_ID_PREFIX} — the SDK stamps this on pre-identify,
 * device-scoped ids. Identified ids (emails, user ids) never use it.
 */
export const isAnonymousDistinctId = (distinctId: string): boolean =>
  distinctId.startsWith(ANONYMOUS_USER_ID_PREFIX);

/**
 * Merges trait maps with PostHog-style semantics: `setOnce` only fills keys that
 * are absent, then `set` overrides unconditionally. Returns a fresh object so
 * the input `current` map is never mutated.
 */
export const mergeTraits = ({
  current,
  setAttributes,
  setOnceAttributes,
}: {
  readonly current: Record<string, unknown>;
  readonly setAttributes: Record<string, unknown>;
  readonly setOnceAttributes: Record<string, unknown>;
}): Record<string, unknown> => {
  const next = { ...current };

  for (const [key, value] of Object.entries(setOnceAttributes)) {
    if (typeof next[key] === "undefined") {
      next[key] = value;
    }
  }

  for (const [key, value] of Object.entries(setAttributes)) {
    next[key] = value;
  }

  return next;
};

/**
 * Computes the next `person_identity.version` for a mapping upsert. When the
 * source contributed no historical events the existing version is preserved
 * (default `0`); otherwise the version advances to at least `1` so the change
 * is observable downstream.
 */
export const nextMappingVersion = ({
  existingVersion,
  hadHistoricalEvents,
}: {
  readonly existingVersion?: number;
  readonly hadHistoricalEvents: boolean;
}): number => {
  if (!hadHistoricalEvents) {
    return existingVersion ?? 0;
  }

  const currentVersion = existingVersion ?? 0;
  if (currentVersion > 0) {
    return currentVersion;
  }
  return 1;
};
