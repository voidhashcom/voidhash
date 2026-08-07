import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  Person,
  PersonIdentity,
  PersonIdentityKind,
  PersonProfile,
} from "../../../src/domain/person/Person.ts";

const at = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

/**
 * Builds a fresh {@link PersonIdentity} per call so no test shares mutable
 * state. Defaults to an anonymous identity with null timestamps; pass
 * overrides for the field under test.
 */
const identity = (overrides: Partial<PersonIdentity> = {}): PersonIdentity =>
  new PersonIdentity({
    id: "pi_default",
    distinctId: "did_default",
    personId: "p_default",
    projectId: "proj_default",
    kind: PersonIdentityKind.Anonymous,
    version: 0,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  });

/**
 * Builds a fresh {@link Person} per call. Defaults to a non-archived,
 * non-merged person with no identities; pass overrides for the field under
 * test.
 */
const person = (overrides: Partial<Person> = {}): Person =>
  new Person({
    id: "p_default",
    projectId: "proj_default",
    email: null,
    name: null,
    archivedAt: null,
    createdAt: null,
    mergedIntoPersonId: null,
    identities: [],
    ...overrides,
  });

describe("PersonIdentity.compareForPrimary", () => {
  it("ranks the identified identity ahead of the anonymous one (higher kind wins)", () => {
    const identified = identity({ distinctId: "did_a", kind: PersonIdentityKind.Identified });
    const anonymous = identity({ distinctId: "did_b", kind: PersonIdentityKind.Anonymous });
    // negative => `identified` sorts before `anonymous`.
    expect(PersonIdentity.compareForPrimary(identified, anonymous)).toBeLessThan(0);
    expect(PersonIdentity.compareForPrimary(anonymous, identified)).toBeGreaterThan(0);
  });

  it("orders same-kind identities by newest updatedAt first", () => {
    const newer = identity({ distinctId: "did_a", updatedAt: at("2026-01-02T00:00:00Z") });
    const older = identity({ distinctId: "did_b", updatedAt: at("2026-01-01T00:00:00Z") });
    expect(PersonIdentity.compareForPrimary(newer, older)).toBeLessThan(0);
    expect(PersonIdentity.compareForPrimary(older, newer)).toBeGreaterThan(0);
  });

  it("falls back to newest createdAt first when kind and updatedAt are equal", () => {
    const sharedUpdatedAt = at("2026-01-05T00:00:00Z");
    const newer = identity({
      distinctId: "did_a",
      updatedAt: sharedUpdatedAt,
      createdAt: at("2026-01-02T00:00:00Z"),
    });
    const older = identity({
      distinctId: "did_b",
      updatedAt: sharedUpdatedAt,
      createdAt: at("2026-01-01T00:00:00Z"),
    });
    expect(PersonIdentity.compareForPrimary(newer, older)).toBeLessThan(0);
    expect(PersonIdentity.compareForPrimary(older, newer)).toBeGreaterThan(0);
  });

  it("uses a lexicographic distinctId tie-breaker when kind/updatedAt/createdAt all match", () => {
    const sharedAt = at("2026-01-05T00:00:00Z");
    const a = identity({ distinctId: "aaa", updatedAt: sharedAt, createdAt: sharedAt });
    const b = identity({ distinctId: "bbb", updatedAt: sharedAt, createdAt: sharedAt });
    // "aaa".localeCompare("bbb") < 0, so `a` sorts first deterministically.
    expect(PersonIdentity.compareForPrimary(a, b)).toBeLessThan(0);
    expect(PersonIdentity.compareForPrimary(b, a)).toBeGreaterThan(0);
    expect(PersonIdentity.compareForPrimary(a, a)).toBe(0);
  });

  it("treats null timestamps as epoch (0) so a dated identity outranks an undated one", () => {
    const dated = identity({ distinctId: "did_a", updatedAt: at("2026-01-01T00:00:00Z") });
    const undated = identity({ distinctId: "did_b", updatedAt: null });
    expect(PersonIdentity.compareForPrimary(dated, undated)).toBeLessThan(0);
    expect(PersonIdentity.compareForPrimary(undated, dated)).toBeGreaterThan(0);
  });
});

describe("Person.isArchived", () => {
  it("returns true when archivedAt is a date", () => {
    expect(person({ archivedAt: at("2026-01-01T00:00:00Z") }).isArchived()).toBe(true);
  });

  it("returns false when archivedAt is null", () => {
    expect(person({ archivedAt: null }).isArchived()).toBe(false);
  });
});

describe("Person.isMerged", () => {
  it("returns true when mergedIntoPersonId is set", () => {
    expect(person({ mergedIntoPersonId: "p_target" }).isMerged()).toBe(true);
  });

  it("returns false when mergedIntoPersonId is null", () => {
    expect(person({ mergedIntoPersonId: null }).isMerged()).toBe(false);
  });
});

describe("Person.primaryIdentity", () => {
  it("returns undefined when the person has no identities", () => {
    expect(person({ identities: [] }).primaryIdentity()).toBeUndefined();
  });

  it("returns the sole identity when there is exactly one", () => {
    const only = identity({ id: "pi_only", distinctId: "did_only" });
    const result = person({ identities: [only] }).primaryIdentity();
    expect(result).toBeDefined();
    expect(result?.id).toBe("pi_only");
  });

  it("picks the identified identity over the anonymous one regardless of array order", () => {
    const anonymous = identity({
      id: "pi_anon",
      distinctId: "did_anon",
      kind: PersonIdentityKind.Anonymous,
    });
    const identified = identity({
      id: "pi_id",
      distinctId: "did_id",
      kind: PersonIdentityKind.Identified,
    });
    expect(person({ identities: [anonymous, identified] }).primaryIdentity()?.id).toBe("pi_id");
    expect(person({ identities: [identified, anonymous] }).primaryIdentity()?.id).toBe("pi_id");
  });

  it("picks the identity with the newer updatedAt when kind is equal", () => {
    const newer = identity({
      id: "pi_newer",
      distinctId: "did_newer",
      updatedAt: at("2026-02-01T00:00:00Z"),
    });
    const older = identity({
      id: "pi_older",
      distinctId: "did_older",
      updatedAt: at("2026-01-01T00:00:00Z"),
    });
    expect(person({ identities: [older, newer] }).primaryIdentity()?.id).toBe("pi_newer");
  });

  it("falls back to createdAt ordering when updatedAt is equal", () => {
    const sharedUpdatedAt = at("2026-03-01T00:00:00Z");
    const newer = identity({
      id: "pi_newer",
      distinctId: "did_newer",
      updatedAt: sharedUpdatedAt,
      createdAt: at("2026-02-01T00:00:00Z"),
    });
    const older = identity({
      id: "pi_older",
      distinctId: "did_older",
      updatedAt: sharedUpdatedAt,
      createdAt: at("2026-01-01T00:00:00Z"),
    });
    expect(person({ identities: [older, newer] }).primaryIdentity()?.id).toBe("pi_newer");
  });

  it("does not mutate the original identities array (sorts a copy)", () => {
    const a = identity({ id: "pi_a", distinctId: "zzz" });
    const b = identity({ id: "pi_b", distinctId: "aaa" });
    const identities = [a, b];
    const subject = person({ identities });
    subject.primaryIdentity();
    // The comparator would reorder [zzz, aaa] -> [aaa, zzz]; the source must
    // stay in its original order because `primaryIdentity` sorts a spread copy.
    expect(subject.identities[0]?.id).toBe("pi_a");
    expect(subject.identities[1]?.id).toBe("pi_b");
  });
});

describe("Person.toProfile", () => {
  it("returns undefined when there is no identity (and thus no distinctId)", () => {
    expect(person({ identities: [] }).toProfile()).toBeUndefined();
  });

  it("projects the person plus its primary identity into a PersonProfile", () => {
    const primary = identity({
      id: "pi_primary",
      distinctId: "did_primary",
      kind: PersonIdentityKind.Identified,
    });
    const profile = person({ id: "p_1", projectId: "proj_1", identities: [primary] }).toProfile();
    expect(profile).toBeInstanceOf(PersonProfile);
    expect(profile?.personId).toBe("p_1");
    expect(profile?.projectId).toBe("proj_1");
  });

  it("preserves the person fields (email, name, archivedAt, createdAt, mergedIntoPersonId)", () => {
    const createdAt = at("2026-01-01T00:00:00Z");
    const archivedAt = at("2026-02-01T00:00:00Z");
    const profile = person({
      email: "person@example.com",
      name: "Ada Lovelace",
      archivedAt,
      createdAt,
      mergedIntoPersonId: "p_target",
      identities: [identity({ distinctId: "did_x" })],
    }).toProfile();
    expect(profile?.email).toBe("person@example.com");
    expect(profile?.name).toBe("Ada Lovelace");
    expect(profile?.archivedAt).toBe(archivedAt);
    expect(profile?.createdAt).toBe(createdAt);
    expect(profile?.mergedIntoPersonId).toBe("p_target");
  });

  it("sources the distinctId from the primary identity", () => {
    const anonymous = identity({ distinctId: "did_anon", kind: PersonIdentityKind.Anonymous });
    const identified = identity({ distinctId: "did_id", kind: PersonIdentityKind.Identified });
    const profile = person({ identities: [anonymous, identified] }).toProfile();
    expect(profile?.distinctId).toBe("did_id");
  });

  it("sources the kind from the primary identity", () => {
    const anonymous = identity({ distinctId: "did_anon", kind: PersonIdentityKind.Anonymous });
    const identified = identity({ distinctId: "did_id", kind: PersonIdentityKind.Identified });
    const profile = person({ identities: [anonymous, identified] }).toProfile();
    expect(profile?.kind).toBe(PersonIdentityKind.Identified);
  });
});
