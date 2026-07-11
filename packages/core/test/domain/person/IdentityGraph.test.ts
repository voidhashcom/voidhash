import { describe, expect, it } from "vite-plus/test";

import {
  applyTraitWrite,
  combineTraitStates,
  comparePersonForMerge,
  type DistinctIdMapping,
  foldTraits,
  type IdentityAssertion,
  type IdentityEventInput,
  type IdentityProjection,
  materializeTraitState,
  planProjectionRebuild,
  project,
  resolveIdentities,
  type TraitFoldState,
  type TraitWrite,
} from "../../../src/domain/person/IdentityGraph.ts";

const EMPTY_TRAIT_STATE: TraitFoldState = { meta: {}, traits: {} };

/** Folds writes one-at-a-time (the streaming path) into a final trait map. */
const foldIncrementally = (writes: ReadonlyArray<TraitWrite>): Record<string, unknown> =>
  writes.reduce<TraitFoldState>((state, write) => applyTraitWrite(state, write), EMPTY_TRAIT_STATE)
    .traits;

/**
 * Normalizes an {@link IdentityProjection} into a plain, order-stable value so
 * two projections can be compared with `toEqual` regardless of internal `Map`
 * iteration order. This is the lens through which every invariant is checked.
 */
const normalize = (projection: IdentityProjection) => ({
  canonicalOf: [...projection.canonicalOf.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  ),
  persons: [...projection.persons.values()]
    .map((person) => ({
      canonicalDistinctId: person.canonicalDistinctId,
      distinctIds: [...person.distinctIds],
      email: person.email ?? null,
      firstSeenTs: person.firstSeenTs,
      lastSeenTs: person.lastSeenTs,
      name: person.name ?? null,
      traits: person.traits,
    }))
    .sort((left, right) =>
      left.canonicalDistinctId < right.canonicalDistinctId
        ? -1
        : left.canonicalDistinctId > right.canonicalDistinctId
          ? 1
          : 0,
    ),
});

/** All permutations of `items` via Heap's algorithm (use only for small N). */
const permutations = <T>(items: ReadonlyArray<T>): Array<Array<T>> => {
  const arr = [...items];
  const result: Array<Array<T>> = [];
  const generate = (k: number): void => {
    if (k <= 1) {
      result.push([...arr]);
      return;
    }
    for (let i = 0; i < k; i++) {
      generate(k - 1);
      const swap = k % 2 === 0 ? i : 0;
      const tmp = arr[swap]!;
      arr[swap] = arr[k - 1]!;
      arr[k - 1] = tmp;
    }
  };
  generate(arr.length);
  return result;
};

/** Deterministic PRNG so the random-permutation test is reproducible. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(items: ReadonlyArray<T>, rng: () => number): Array<T> => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
};

/**
 * Asserts the central invariant: `project` is a pure function of the *set* of
 * events. Every permutation of `events` must produce a deep-equal projection.
 * For N ≤ 7 this enumerates all N! orderings exhaustively.
 */
const expectPermutationInvariant = (events: ReadonlyArray<IdentityEventInput>): void => {
  expect(events.length).toBeLessThanOrEqual(7);
  const reference = normalize(project(events));
  for (const ordering of permutations(events)) {
    expect(normalize(project(ordering))).toEqual(reference);
  }
};

let eventSeq = 0;
/** Builds an event with a unique, stable `eventId` unless one is supplied. */
const ev = (
  input: Omit<IdentityEventInput, "eventId"> & { readonly eventId?: string },
): IdentityEventInput => ({
  eventId: input.eventId ?? `auto_${eventSeq++}`,
  ...input,
});

describe("resolveIdentities", () => {
  it("keeps unrelated distinct ids in separate components", () => {
    const resolution = resolveIdentities({
      observations: [
        { distinctId: "u1", eventTs: 100 },
        { distinctId: "u2", eventTs: 100 },
      ],
    });
    expect(resolution.canonicalOf.get("u1")).toBe("u1");
    expect(resolution.canonicalOf.get("u2")).toBe("u2");
    expect(resolution.membersOf.size).toBe(2);
  });

  it("picks the oldest (smallest firstSeenTs) member as the component canonical", () => {
    const resolution = resolveIdentities({
      assertions: [{ distinctIdA: "email", distinctIdB: "phone", eventTs: 300 }],
      observations: [
        { distinctId: "email", eventTs: 50 },
        { distinctId: "phone", eventTs: 400 },
      ],
    });
    expect(resolution.canonicalOf.get("email")).toBe("email");
    expect(resolution.canonicalOf.get("phone")).toBe("email");
    expect(resolution.membersOf.get("email")).toEqual(["email", "phone"]);
  });

  it("breaks firstSeenTs ties lexicographically for determinism", () => {
    const resolution = resolveIdentities({
      assertions: [{ distinctIdA: "bbb", distinctIdB: "aaa", eventTs: 100 }],
      observations: [
        { distinctId: "aaa", eventTs: 100 },
        { distinctId: "bbb", eventTs: 100 },
      ],
    });
    expect(resolution.canonicalOf.get("bbb")).toBe("aaa");
  });

  it("is independent of assertion order across a transitive chain", () => {
    const forward = resolveIdentities({
      assertions: [
        { distinctIdA: "anon", distinctIdB: "email", eventTs: 200 },
        { distinctIdA: "email", distinctIdB: "phone", eventTs: 300 },
      ],
      observations: [{ distinctId: "anon", eventTs: 100 }],
    });
    const reversed = resolveIdentities({
      assertions: [
        { distinctIdA: "email", distinctIdB: "phone", eventTs: 300 },
        { distinctIdA: "anon", distinctIdB: "email", eventTs: 200 },
      ],
      observations: [{ distinctId: "anon", eventTs: 100 }],
    });
    expect(forward.canonicalOf.get("phone")).toBe("anon");
    expect(reversed.canonicalOf.get("phone")).toBe("anon");
    expect([...forward.canonicalOf.entries()].sort()).toEqual(
      [...reversed.canonicalOf.entries()].sort(),
    );
  });
});

describe("foldTraits", () => {
  it("resolves a $set key to the newest write by (eventTs, eventId)", () => {
    const writes: ReadonlyArray<TraitWrite> = [
      { eventId: "a", eventTs: 100, set: { plan: "free" } },
      { eventId: "b", eventTs: 200, set: { plan: "pro" } },
    ];
    expect(foldTraits(writes).plan).toBe("pro");
    expect(foldTraits([...writes].reverse()).plan).toBe("pro");
  });

  it("breaks $set ties on equal eventTs by greater eventId", () => {
    const writes: ReadonlyArray<TraitWrite> = [
      { eventId: "z", eventTs: 200, set: { plan: "z-wins" } },
      { eventId: "a", eventTs: 200, set: { plan: "a-loses" } },
    ];
    expect(foldTraits(writes).plan).toBe("z-wins");
    expect(foldTraits([...writes].reverse()).plan).toBe("z-wins");
  });

  it("resolves a $set_once key to the earliest write", () => {
    const writes: ReadonlyArray<TraitWrite> = [
      { eventId: "a", eventTs: 100, setOnce: { source: "google" } },
      { eventId: "b", eventTs: 200, setOnce: { source: "facebook" } },
    ];
    expect(foldTraits(writes).source).toBe("google");
    expect(foldTraits([...writes].reverse()).source).toBe("google");
  });

  it("lets any $set outrank $set_once for the same key, regardless of timing", () => {
    const writes: ReadonlyArray<TraitWrite> = [
      { eventId: "a", eventTs: 100, setOnce: { source: "google" } },
      { eventId: "b", eventTs: 50, set: { source: "paid" } },
    ];
    expect(foldTraits(writes).source).toBe("paid");
    expect(foldTraits([...writes].reverse()).source).toBe("paid");
  });
});

describe("applyTraitWrite", () => {
  it("matches foldTraits when writes are applied incrementally in any order", () => {
    const writes: ReadonlyArray<TraitWrite> = [
      { eventId: "a", eventTs: 100, setOnce: { firstTouch: "google" }, set: { plan: "free" } },
      { eventId: "b", eventTs: 50, set: { plan: "trial" } },
      { eventId: "c", eventTs: 200, set: { plan: "pro" }, setOnce: { firstTouch: "facebook" } },
      { eventId: "d", eventTs: 200, set: { region: "eu" } },
      { eventId: "e", eventTs: 150, setOnce: { plan: "should-lose-to-set" } },
    ];
    const batch = foldTraits(writes);
    for (const ordering of permutations(writes)) {
      expect(foldIncrementally(ordering)).toEqual(batch);
    }
    // sanity on the resolved values themselves
    expect(batch).toEqual({ firstTouch: "google", plan: "pro", region: "eu" });
  });

  it("carries forward LWW metadata so a later older write cannot regress a key", () => {
    const newest = applyTraitWrite(EMPTY_TRAIT_STATE, {
      eventId: "b",
      eventTs: 200,
      set: { plan: "pro" },
    });
    const afterOlder = applyTraitWrite(newest, {
      eventId: "a",
      eventTs: 100,
      set: { plan: "free" },
    });
    expect(afterOlder.traits.plan).toBe("pro");
    expect(afterOlder.meta.plan).toEqual({ id: "b", mode: "set", ts: 200 });
  });
});

describe("comparePersonForMerge", () => {
  const at = (iso: string) => new Date(iso);

  it("selects the person with the earlier firstSeenAt as survivor (negative => left wins)", () => {
    const older = { id: "p_b", firstSeenAt: at("2026-01-01T00:00:00Z") };
    const younger = { id: "p_a", firstSeenAt: at("2026-02-01T00:00:00Z") };
    expect(comparePersonForMerge(older, younger)).toBeLessThan(0);
    expect(comparePersonForMerge(younger, older)).toBeGreaterThan(0);
  });

  it("is antisymmetric / order-independent: sign flips when arguments swap", () => {
    const a = { id: "p_a", firstSeenAt: at("2026-03-01T00:00:00Z") };
    const b = { id: "p_b", firstSeenAt: at("2026-01-01T00:00:00Z") };
    expect(Math.sign(comparePersonForMerge(a, b))).toBe(-Math.sign(comparePersonForMerge(b, a)));
  });

  it("falls back to createdAt when firstSeenAt is absent", () => {
    const older = { id: "p_b", createdAt: at("2026-01-01T00:00:00Z") };
    const younger = { id: "p_a", firstSeenAt: at("2026-02-01T00:00:00Z") };
    expect(comparePersonForMerge(older, younger)).toBeLessThan(0);
  });

  it("breaks exact birth-time ties by lexicographically smaller id", () => {
    const shared = at("2026-01-01T00:00:00Z");
    const a = { id: "p_aaa", firstSeenAt: shared };
    const b = { id: "p_bbb", firstSeenAt: shared };
    expect(comparePersonForMerge(a, b)).toBeLessThan(0);
    expect(comparePersonForMerge(b, a)).toBeGreaterThan(0);
    expect(comparePersonForMerge(a, a)).toBe(0);
  });
});

describe("combineTraitStates", () => {
  const state = (
    traits: Record<string, unknown>,
    meta: TraitFoldState["meta"],
  ): TraitFoldState => ({ meta, traits });

  it("is commutative for the merged result", () => {
    const left = state(
      { plan: "pro", region: "us" },
      { plan: { id: "p", mode: "set", ts: 200 }, region: { id: "r", mode: "set", ts: 100 } },
    );
    const right = state(
      { plan: "free", source: "ad" },
      { plan: { id: "q", mode: "set", ts: 150 }, source: { id: "s", mode: "setOnce", ts: 80 } },
    );
    expect(combineTraitStates(left, right)).toEqual(combineTraitStates(right, left));
    // newest $set wins for the shared `plan` key.
    expect(combineTraitStates(left, right).traits.plan).toBe("pro");
  });

  it("lets $set outrank $set_once and keeps the earliest $set_once", () => {
    const left = state({ a: "set-val" }, { a: { id: "1", mode: "set", ts: 50 } });
    const right = state({ a: "once-val" }, { a: { id: "2", mode: "setOnce", ts: 10 } });
    expect(combineTraitStates(left, right).traits.a).toBe("set-val");

    const onceEarly = state({ b: "early" }, { b: { id: "1", mode: "setOnce", ts: 10 } });
    const onceLate = state({ b: "late" }, { b: { id: "2", mode: "setOnce", ts: 90 } });
    expect(combineTraitStates(onceEarly, onceLate).traits.b).toBe("early");
  });

  it("preserves legacy traits lacking metadata via materializeTraitState", () => {
    const legacy = materializeTraitState({ legacyKey: "kept" }, null);
    const fresh = state({ newKey: "added" }, { newKey: { id: "1", mode: "set", ts: 100 } });
    const merged = combineTraitStates(legacy, fresh);
    expect(merged.traits).toEqual({ legacyKey: "kept", newKey: "added" });

    // A real write still overrides the legacy floor (ts 0).
    const overridden = applyTraitWrite(legacy, {
      eventId: "x",
      eventTs: 5,
      set: { legacyKey: "new" },
    });
    expect(overridden.traits.legacyKey).toBe("new");
  });
});

describe("planProjectionRebuild", () => {
  const at = (iso: string) => new Date(iso);
  const map = (distinctId: string, id: string, firstSeen: string): DistinctIdMapping => ({
    distinctId,
    person: { id, firstSeenAt: at(firstSeen) },
  });

  it("collapses a transitive chain onto the single oldest person", () => {
    const mappings: ReadonlyArray<DistinctIdMapping> = [
      map("anon", "p_anon", "2026-01-01T00:00:00Z"),
      map("email", "p_email", "2026-02-01T00:00:00Z"),
      map("phone", "p_phone", "2026-03-01T00:00:00Z"),
    ];
    const assertions: ReadonlyArray<IdentityAssertion> = [
      { distinctIdA: "anon", distinctIdB: "email", eventTs: 1 },
      { distinctIdA: "email", distinctIdB: "phone", eventTs: 2 },
    ];
    const plan = planProjectionRebuild({ assertions, mappings });

    // All distinct ids resolve to the oldest person.
    expect(plan.canonicalPersonOf.get("anon")).toBe("p_anon");
    expect(plan.canonicalPersonOf.get("email")).toBe("p_anon");
    expect(plan.canonicalPersonOf.get("phone")).toBe("p_anon");
    // The two younger persons merge into it.
    expect(plan.mergedInto.get("p_email")).toBe("p_anon");
    expect(plan.mergedInto.get("p_phone")).toBe("p_anon");
    expect(plan.mergedInto.has("p_anon")).toBe(false);
  });

  it("is independent of assertion/mapping order", () => {
    const mappings: ReadonlyArray<DistinctIdMapping> = [
      map("a", "p_a", "2026-02-01T00:00:00Z"),
      map("b", "p_b", "2026-01-01T00:00:00Z"),
      map("c", "p_c", "2026-03-01T00:00:00Z"),
    ];
    const assertions: ReadonlyArray<IdentityAssertion> = [
      { distinctIdA: "a", distinctIdB: "b", eventTs: 1 },
      { distinctIdA: "c", distinctIdB: "a", eventTs: 2 },
    ];
    const forward = planProjectionRebuild({ assertions, mappings });
    const reversed = planProjectionRebuild({
      assertions: [...assertions].reverse(),
      mappings: [...mappings].reverse(),
    });
    const normalize = (plan: ReturnType<typeof planProjectionRebuild>) => ({
      canonical: [...plan.canonicalPersonOf.entries()].sort(),
      merged: [...plan.mergedInto.entries()].sort(),
    });
    expect(normalize(forward)).toEqual(normalize(reversed));
    // p_b is the oldest → the survivor for the whole {a,b,c} component.
    expect(forward.canonicalPersonOf.get("c")).toBe("p_b");
  });

  it("keeps unrelated distinct ids on their own persons (no merges)", () => {
    const plan = planProjectionRebuild({
      mappings: [map("x", "p_x", "2026-01-01T00:00:00Z"), map("y", "p_y", "2026-01-01T00:00:00Z")],
    });
    expect(plan.canonicalPersonOf.get("x")).toBe("p_x");
    expect(plan.canonicalPersonOf.get("y")).toBe("p_y");
    expect(plan.mergedInto.size).toBe(0);
  });
});

describe("project — permutation invariance", () => {
  it("is order-independent across a reversed identify chain (anon → email → phone)", () => {
    const events = [
      ev({ distinctId: "anon", eventTs: 100, set: { device: "ios" } }),
      ev({ distinctId: "email", eventTs: 200, previousDistinctId: "anon", email: "a@x.com" }),
      ev({ distinctId: "phone", eventTs: 300, previousDistinctId: "email" }),
    ];
    expectPermutationInvariant(events);

    const projection = project(events);
    // anon has the smallest firstSeenTs (100) → it is the canonical person.
    expect(projection.canonicalOf.get("phone")).toBe("anon");
    expect(projection.persons.size).toBe(1);
    const person = projection.persons.get("anon");
    expect(person?.distinctIds).toEqual(["anon", "email", "phone"]);
    expect(person?.email).toBe("a@x.com");
    expect(person?.firstSeenTs).toBe(100);
    expect(person?.lastSeenTs).toBe(300);
  });

  it("attributes a late anonymous event to the already-merged person", () => {
    const events = [
      ev({ distinctId: "email", eventTs: 100, set: { y: 2 } }),
      ev({ distinctId: "email", eventTs: 200, previousDistinctId: "anon" }),
      // The anonymous capture "arrives" after the identify but is older only
      // than the identify; email (ts 100) stays canonical.
      ev({ distinctId: "anon", eventTs: 300, set: { x: 1 } }),
    ];
    expectPermutationInvariant(events);

    const person = project(events).persons.get("email");
    expect(person?.distinctIds).toEqual(["anon", "email"]);
    expect(person?.traits).toEqual({ x: 1, y: 2 });
  });

  it("keeps disjoint users as distinct persons", () => {
    const events = [
      ev({ distinctId: "u1", eventTs: 100, set: { a: 1 } }),
      ev({ distinctId: "u2", eventTs: 100, set: { b: 2 } }),
    ];
    expectPermutationInvariant(events);
    expect(project(events).persons.size).toBe(2);
  });

  it("treats self-identify as a no-op single-member component", () => {
    const events = [ev({ distinctId: "u1", eventTs: 100, previousDistinctId: "u1" })];
    const projection = project(events);
    expect(projection.persons.size).toBe(1);
    expect(projection.persons.get("u1")?.distinctIds).toEqual(["u1"]);
  });

  it("folds traits order-independently across a merged component", () => {
    const events = [
      ev({ distinctId: "anon", eventTs: 100, setOnce: { firstTouch: "google" } }),
      ev({ distinctId: "anon", eventTs: 150, set: { plan: "free" } }),
      ev({ distinctId: "user", eventTs: 200, previousDistinctId: "anon", set: { plan: "pro" } }),
      ev({ distinctId: "user", eventTs: 250, setOnce: { firstTouch: "facebook" } }),
    ];
    expectPermutationInvariant(events);

    const person = project(events).persons.get("anon");
    // newest $set wins for `plan`; earliest $set_once wins for `firstTouch`.
    expect(person?.traits).toEqual({ firstTouch: "google", plan: "pro" });
  });
});

describe("project — idempotency and duplicate safety", () => {
  it("is unchanged when a subset of events is delivered twice", () => {
    const events = [
      ev({ distinctId: "anon", eventTs: 100, set: { device: "ios" } }),
      ev({ distinctId: "user", eventTs: 200, previousDistinctId: "anon", set: { plan: "pro" } }),
    ];
    const once = normalize(project(events));
    const withDuplicates = normalize(project([events[0]!, ...events, events[1]!]));
    expect(withDuplicates).toEqual(once);
  });
});

describe("project — large random permutation invariance", () => {
  it("holds across 200 seeded shuffles of a 12-event multi-merge set", () => {
    const events = [
      ev({ distinctId: "anonA", eventTs: 10, set: { device: "ios" } }),
      ev({ distinctId: "anonB", eventTs: 20, set: { device: "android" } }),
      ev({ distinctId: "mail1", eventTs: 30, previousDistinctId: "anonA", email: "one@x.com" }),
      ev({ distinctId: "mail2", eventTs: 40, previousDistinctId: "anonB", email: "two@x.com" }),
      ev({ distinctId: "anonA", eventTs: 50, set: { plan: "free" } }),
      ev({ distinctId: "mail1", eventTs: 60, set: { plan: "pro" } }),
      ev({ distinctId: "phone1", eventTs: 70, previousDistinctId: "mail1" }),
      ev({ distinctId: "anonC", eventTs: 80, set: { device: "web" } }),
      ev({ distinctId: "mail2", eventTs: 90, setOnce: { firstTouch: "ad" } }),
      ev({ distinctId: "mail2", eventTs: 100, setOnce: { firstTouch: "organic" } }),
      ev({ distinctId: "phone1", eventTs: 110, set: { plan: "enterprise" } }),
      ev({ distinctId: "anonC", eventTs: 120, set: { plan: "trial" } }),
    ];
    const reference = normalize(project(events));
    const rng = mulberry32(0x5eed);
    for (let i = 0; i < 200; i++) {
      expect(normalize(project(shuffle(events, rng)))).toEqual(reference);
    }

    // Spot-check the resolved shape so a consistent-but-wrong canonical fails.
    const projection = project(events);
    expect(projection.canonicalOf.get("phone1")).toBe("anonA");
    expect(projection.persons.get("anonA")?.distinctIds).toEqual(["anonA", "mail1", "phone1"]);
    expect(projection.persons.get("anonA")?.traits.plan).toBe("enterprise");
    expect(projection.persons.get("anonB")?.distinctIds).toEqual(["anonB", "mail2"]);
    expect(projection.persons.get("anonB")?.traits.firstTouch).toBe("ad");
  });
});
