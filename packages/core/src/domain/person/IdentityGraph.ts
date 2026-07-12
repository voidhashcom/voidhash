/**
 * Order-agnostic identity resolution — the pure core of the event-sourced
 * ("Option B") identity model described in
 * `docs/order-agnostic-analytics-events.md`.
 *
 * The whole point of this module: every value it computes is a function of the
 * *set* of identity inputs, never of the order they are folded in. Each fold is
 * commutative, associative and idempotent (a join-semilattice / state-based
 * CRDT), so a retried, duplicated, or late-arriving event always re-folds to
 * the identical state. The DB-facing projection service applies the result of
 * {@link project} to Postgres; this file holds zero IO so the invariants can be
 * proven exhaustively in unit tests.
 *
 * Two independent pieces compose into {@link project}:
 *
 * 1. {@link resolveIdentities} — a deterministic union-find over distinct ids.
 *    An `$identify` event is an unordered "these two are the same person" edge.
 *    The canonical member of each connected component is the one with the
 *    smallest `(firstSeenTs, distinctId)`. Because `min` is order-independent,
 *    so is the canonical — this is what makes `identify(a→b)` then
 *    `identify(b→c)` converge to the same person regardless of arrival order.
 *
 * 2. {@link foldTraits} — a per-key last-write-wins register fold keyed by
 *    `(eventTs, eventId)`. `$set` keeps the newest value for a key, `$set_once`
 *    keeps the earliest, and `$set` always outranks `$set_once` for the same
 *    key. No key's resolved value depends on processing order.
 */

/** A distinct id observed at a given event time (epoch milliseconds). */
export interface IdentityObservation {
  readonly distinctId: string;
  /** Event timestamp — intrinsic to the event, NOT the processing time. */
  readonly eventTs: number;
}

/**
 * An assertion that two distinct ids name the same person — the order-agnostic
 * reading of an `$identify`. The pair is unordered: `(a, b)` and `(b, a)` carry
 * identical meaning.
 */
export interface IdentityAssertion {
  readonly distinctIdA: string;
  readonly distinctIdB: string;
  readonly eventTs: number;
}

/** Result of {@link resolveIdentities}. */
export interface IdentityResolution {
  /** Every distinct id mapped to the canonical distinct id of its component. */
  readonly canonicalOf: ReadonlyMap<string, string>;
  /** Canonical distinct id mapped to its sorted component members. */
  readonly membersOf: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Per distinct id, the earliest event timestamp it was seen at. */
  readonly firstSeenTs: ReadonlyMap<string, number>;
}

/** Lexicographic, locale-independent string order for deterministic results. */
const compareString = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Computes connected components of distinct ids under the assertion graph and
 * picks each component's canonical member deterministically.
 *
 * Canonical selection rule: the member with the smallest
 * `(firstSeenTs, distinctId)`. `firstSeenTs` is the minimum event timestamp
 * across every observation/assertion that references the id, computed in a
 * first pass so the union-by-key tie-break is fixed before any union runs.
 * With fixed keys, the root of any component is always its global minimum under
 * that key, and `min` is commutative/associative/idempotent — therefore the
 * whole resolution is independent of input order.
 */
export const resolveIdentities = ({
  observations,
  assertions,
}: {
  readonly observations?: Iterable<IdentityObservation>;
  readonly assertions?: Iterable<IdentityAssertion>;
}): IdentityResolution => {
  const firstSeen = new Map<string, number>();
  const see = (distinctId: string, eventTs: number): void => {
    const current = firstSeen.get(distinctId);
    if (current === undefined || eventTs < current) {
      firstSeen.set(distinctId, eventTs);
    }
  };

  const edges: Array<readonly [string, string]> = [];
  for (const observation of observations ?? []) {
    see(observation.distinctId, observation.eventTs);
  }
  for (const assertion of assertions ?? []) {
    see(assertion.distinctIdA, assertion.eventTs);
    see(assertion.distinctIdB, assertion.eventTs);
    if (assertion.distinctIdA !== assertion.distinctIdB) {
      edges.push([assertion.distinctIdA, assertion.distinctIdB]);
    }
  }

  // Union-find. Every key's sort order is fully known before unioning, so the
  // root that survives each union is always the component minimum.
  const parent = new Map<string, string>();
  for (const distinctId of firstSeen.keys()) {
    parent.set(distinctId, distinctId);
  }

  const findRoot = (start: string): string => {
    let root = start;
    let next = parent.get(root);
    while (next !== undefined && next !== root) {
      root = next;
      next = parent.get(root);
    }
    // Path compression keeps repeated lookups near-constant.
    let cursor = start;
    while (cursor !== root) {
      const parentOfCursor = parent.get(cursor) ?? root;
      parent.set(cursor, root);
      cursor = parentOfCursor;
    }
    return root;
  };

  const compareKey = (left: string, right: string): number => {
    const leftTs = firstSeen.get(left) ?? 0;
    const rightTs = firstSeen.get(right) ?? 0;
    if (leftTs !== rightTs) {
      return leftTs - rightTs;
    }
    return compareString(left, right);
  };

  for (const [a, b] of edges) {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA === rootB) {
      continue;
    }
    // Smaller key becomes the parent → the surviving root is the component min.
    if (compareKey(rootA, rootB) <= 0) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootA, rootB);
    }
  }

  const canonicalOf = new Map<string, string>();
  const members = new Map<string, Array<string>>();
  for (const distinctId of firstSeen.keys()) {
    const root = findRoot(distinctId);
    canonicalOf.set(distinctId, root);
    const list = members.get(root);
    if (list) {
      list.push(distinctId);
    } else {
      members.set(root, [distinctId]);
    }
  }

  const membersOf = new Map<string, ReadonlyArray<string>>();
  for (const [root, list] of members) {
    membersOf.set(root, [...list].sort(compareString));
  }

  return { canonicalOf, firstSeenTs: firstSeen, membersOf };
};

/** The birth coordinates of a person, used to pick a merge survivor. */
export interface PersonSeniority {
  readonly id: string;
  readonly firstSeenAt?: Date | null;
  readonly createdAt?: Date | null;
}

/**
 * Deterministic, order-agnostic survivor selection for a person merge: the
 * **older** person wins, measured by earliest first-seen time (falling back to
 * created-at, then epoch), with the lexicographically smaller `id` as the final
 * tie-break. Returns a negative number when `left` should survive, positive when
 * `right` should, `0` only for the same id.
 *
 * Because the result is a pure function of the persons' birth times — not the
 * order their events were processed — choosing the survivor this way makes a
 * merge commutative: `identify(a→b)` then `identify(b→c)` converge to the same
 * surviving person regardless of arrival order. `firstSeenAt` is preferred over
 * `createdAt` because {@link materializeTraitState}'s caller lowers it toward the
 * component's true minimum event time as more events arrive, so the winner
 * stabilizes on the genuinely-oldest identity.
 */
export const comparePersonForMerge = (left: PersonSeniority, right: PersonSeniority): number => {
  const leftTs = (left.firstSeenAt ?? left.createdAt)?.getTime() ?? 0;
  const rightTs = (right.firstSeenAt ?? right.createdAt)?.getTime() ?? 0;
  if (leftTs !== rightTs) {
    return leftTs - rightTs;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
};

/** One `(distinctId → person)` row, used to rebuild the projection from the log. */
export interface DistinctIdMapping {
  readonly distinctId: string;
  readonly person: PersonSeniority;
}

/** The recomputed projection produced by {@link planProjectionRebuild}. */
export interface RebuildPlan {
  /** Every distinct id mapped to the canonical person id it should resolve to. */
  readonly canonicalPersonOf: ReadonlyMap<string, string>;
  /** Each non-canonical person id mapped to the person it should merge into. */
  readonly mergedInto: ReadonlyMap<string, string>;
}

/**
 * Recomputes the `(distinctId → person)` / `mergedIntoPersonId` projection purely
 * from the *set* of identity assertions plus the current distinct-id→person
 * mappings — the disaster-recovery / rule-change rebuild for the event-sourced
 * model.
 *
 * Assertions define connected components ({@link resolveIdentities}); within each
 * component the canonical person is the oldest ({@link comparePersonForMerge}),
 * every distinct id resolves to it, and every other person in the component is
 * marked merged into it. Because both the component partition and the canonical
 * selection are pure functions of the inputs, the plan is independent of the
 * order assertions or mappings are supplied — re-running it converges.
 */
export const planProjectionRebuild = (input: {
  readonly assertions?: Iterable<IdentityAssertion>;
  readonly mappings: Iterable<DistinctIdMapping>;
}): RebuildPlan => {
  const personByDistinct = new Map<string, PersonSeniority>();
  const observations: Array<IdentityObservation> = [];
  for (const mapping of input.mappings) {
    personByDistinct.set(mapping.distinctId, mapping.person);
    observations.push({
      distinctId: mapping.distinctId,
      eventTs: mapping.person.firstSeenAt?.getTime() ?? mapping.person.createdAt?.getTime() ?? 0,
    });
  }

  const resolution = resolveIdentities({ assertions: input.assertions, observations });

  const canonicalPersonOf = new Map<string, string>();
  const mergedInto = new Map<string, string>();

  for (const members of resolution.membersOf.values()) {
    const personsInComponent = new Map<string, PersonSeniority>();
    for (const distinctId of members) {
      const person = personByDistinct.get(distinctId);
      if (person) {
        personsInComponent.set(person.id, person);
      }
    }
    let canonical: PersonSeniority | undefined;
    for (const person of personsInComponent.values()) {
      if (!canonical || comparePersonForMerge(person, canonical) < 0) {
        canonical = person;
      }
    }
    if (!canonical) {
      continue;
    }
    for (const distinctId of members) {
      if (personByDistinct.has(distinctId)) {
        canonicalPersonOf.set(distinctId, canonical.id);
      }
    }
    for (const person of personsInComponent.values()) {
      if (person.id !== canonical.id) {
        mergedInto.set(person.id, canonical.id);
      }
    }
  }

  return { canonicalPersonOf, mergedInto };
};

/** A single `$set` / `$set_once` write carrying its event coordinates. */
export interface TraitWrite {
  readonly eventTs: number;
  /** Stable, content-derived event id — the deterministic same-`eventTs` tie-break. */
  readonly eventId: string;
  readonly set?: Readonly<Record<string, unknown>>;
  readonly setOnce?: Readonly<Record<string, unknown>>;
}

interface LwwCell {
  readonly ts: number;
  readonly id: string;
  readonly value: unknown;
}

/** True when `(aTs, aId)` is strictly later than `(bTs, bId)`. */
const isLater = (aTs: number, aId: string, bTs: number, bId: string): boolean =>
  aTs > bTs || (aTs === bTs && aId > bId);

/**
 * Per-key last-write-wins fold for person traits, independent of fold order.
 *
 * - `$set` keys resolve to the value from the write with the greatest
 *   `(eventTs, eventId)` — newest wins.
 * - `$set_once` keys resolve to the value from the write with the smallest
 *   `(eventTs, eventId)` — earliest wins.
 * - A key touched by any `$set` always takes the `$set` value over any
 *   `$set_once` value, mirroring PostHog semantics while staying commutative.
 */
export const foldTraits = (writes: Iterable<TraitWrite>): Record<string, unknown> => {
  const bestSet = new Map<string, LwwCell>();
  const bestSetOnce = new Map<string, LwwCell>();

  for (const write of writes) {
    if (write.set) {
      for (const [key, value] of Object.entries(write.set)) {
        const current = bestSet.get(key);
        if (!current || isLater(write.eventTs, write.eventId, current.ts, current.id)) {
          bestSet.set(key, { id: write.eventId, ts: write.eventTs, value });
        }
      }
    }
    if (write.setOnce) {
      for (const [key, value] of Object.entries(write.setOnce)) {
        const current = bestSetOnce.get(key);
        if (!current || isLater(current.ts, current.id, write.eventTs, write.eventId)) {
          bestSetOnce.set(key, { id: write.eventId, ts: write.eventTs, value });
        }
      }
    }
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, cell] of bestSetOnce) {
    resolved[key] = cell.value;
  }
  for (const [key, cell] of bestSet) {
    resolved[key] = cell.value;
  }
  return resolved;
};

/** Per-trait LWW bookkeeping cell — structurally `PersonTraitMeta` in the DB. */
export interface TraitMetaCell {
  readonly ts: number;
  readonly id: string;
  readonly mode: "set" | "setOnce";
}

/** Per-trait LWW metadata map — structurally `PersonTraitsMeta` in the DB. */
export type TraitsMeta = Record<string, TraitMetaCell>;

/** A person's resolved traits plus the LWW metadata needed to fold more writes. */
export interface TraitFoldState {
  readonly traits: Record<string, unknown>;
  readonly meta: TraitsMeta;
}

/**
 * Incrementally folds one trait write into existing `(traits, meta)` state with
 * the same per-key rules as {@link foldTraits}. Applying writes one at a time in
 * any order — exactly what the streaming projection does — converges to the same
 * result as folding the whole set at once, so the persisted person row never
 * depends on processing order. Returns fresh objects; inputs are not mutated.
 */
export const applyTraitWrite = (state: TraitFoldState, write: TraitWrite): TraitFoldState => {
  const traits = { ...state.traits };
  const meta: TraitsMeta = { ...state.meta };

  if (write.setOnce) {
    for (const [key, value] of Object.entries(write.setOnce)) {
      const cell = meta[key];
      // `$set_once` loses to any existing `$set`; among `$set_once` writes the
      // earliest wins.
      const wins =
        !cell ||
        (cell.mode === "setOnce" && isLater(cell.ts, cell.id, write.eventTs, write.eventId));
      if (wins) {
        traits[key] = value;
        meta[key] = { id: write.eventId, mode: "setOnce", ts: write.eventTs };
      }
    }
  }

  if (write.set) {
    for (const [key, value] of Object.entries(write.set)) {
      const cell = meta[key];
      // `$set` always outranks `$set_once`; among `$set` writes the newest wins.
      const wins =
        !cell || cell.mode === "setOnce" || isLater(write.eventTs, write.eventId, cell.ts, cell.id);
      if (wins) {
        traits[key] = value;
        meta[key] = { id: write.eventId, mode: "set", ts: write.eventTs };
      }
    }
  }

  return { meta, traits };
};

/**
 * Lifts a stored `(traits, meta)` pair into a {@link TraitFoldState},
 * synthesizing a floor meta cell for any legacy trait key that predates
 * per-trait metadata. The floor (`ts: 0`, `mode: "set"`) preserves the value
 * through {@link combineTraitStates} yet loses to any real write.
 */
export const materializeTraitState = (
  traits: Readonly<Record<string, unknown>> | null | undefined,
  meta: Readonly<TraitsMeta> | null | undefined,
): TraitFoldState => {
  const nextTraits: Record<string, unknown> = { ...(traits ?? {}) };
  const nextMeta: TraitsMeta = { ...(meta ?? {}) };
  for (const key of Object.keys(nextTraits)) {
    if (!nextMeta[key]) {
      nextMeta[key] = { id: "", mode: "set", ts: 0 };
    }
  }
  return { meta: nextMeta, traits: nextTraits };
};

/** True when trait cell `a` outranks `b` for the same key under LWW rules. */
const traitCellWins = (a: TraitMetaCell, b: TraitMetaCell): boolean => {
  if (a.mode !== b.mode) {
    return a.mode === "set"; // $set always beats $set_once
  }
  if (a.mode === "set") {
    return isLater(a.ts, a.id, b.ts, b.id); // newest $set wins
  }
  return isLater(b.ts, b.id, a.ts, a.id); // earliest $set_once wins
};

/**
 * Per-key LWW merge of two persons' trait states — used when two persons merge.
 * Each key's winner is chosen by the same rules as {@link foldTraits}, so the
 * merged result is commutative: `combineTraitStates(a, b)` deep-equals
 * `combineTraitStates(b, a)`. Pass states through {@link materializeTraitState}
 * first so legacy keys without metadata are not dropped.
 */
export const combineTraitStates = (left: TraitFoldState, right: TraitFoldState): TraitFoldState => {
  const meta: TraitsMeta = {};
  const traits: Record<string, unknown> = {};
  const keys = new Set<string>([...Object.keys(left.meta), ...Object.keys(right.meta)]);
  for (const key of keys) {
    const leftCell = left.meta[key];
    const rightCell = right.meta[key];
    if (leftCell && rightCell) {
      const leftWins = traitCellWins(leftCell, rightCell);
      meta[key] = leftWins ? leftCell : rightCell;
      traits[key] = leftWins ? left.traits[key] : right.traits[key];
    } else if (leftCell) {
      meta[key] = leftCell;
      traits[key] = left.traits[key];
    } else if (rightCell) {
      meta[key] = rightCell;
      traits[key] = right.traits[key];
    }
  }
  return { meta, traits };
};

/**
 * One ingested event's contribution to identity state. A plain capture is an
 * observation; an `$identify` additionally carries `previousDistinctId` (the
 * stitch edge). Trait/email/name fields are optional per-event writes.
 */
export interface IdentityEventInput {
  readonly distinctId: string;
  readonly eventTs: number;
  /** Stable, content-derived event id — the deterministic same-`eventTs` tie-break. */
  readonly eventId: string;
  /** Present on `$identify`: the previous distinct id being stitched in. */
  readonly previousDistinctId?: string;
  readonly set?: Readonly<Record<string, unknown>>;
  readonly setOnce?: Readonly<Record<string, unknown>>;
  readonly email?: string;
  readonly name?: string;
}

/** The fully-resolved view of a single person (one canonical component). */
export interface ResolvedPerson {
  readonly canonicalDistinctId: string;
  readonly distinctIds: ReadonlyArray<string>;
  readonly firstSeenTs: number;
  readonly lastSeenTs: number;
  readonly traits: Record<string, unknown>;
  readonly email?: string;
  readonly name?: string;
}

/** Result of {@link project}. */
export interface IdentityProjection {
  /** Every distinct id mapped to its canonical (person-key) distinct id. */
  readonly canonicalOf: ReadonlyMap<string, string>;
  /** Canonical distinct id mapped to the resolved person. */
  readonly persons: ReadonlyMap<string, ResolvedPerson>;
}

/**
 * Folds a whole set of events into the canonical identity projection: connected
 * components, their canonical person, and each person's order-agnostic profile
 * (traits via {@link foldTraits}, `firstSeen`/`lastSeen` via min/max,
 * `email`/`name` via newest-wins LWW).
 *
 * `project(events)` depends only on the *set* `events`: any permutation,
 * duplication, or re-batching yields a deep-equal result. This is the contract
 * the invariant test-suite enforces and the property the projection service
 * relies on to drop the legacy per-identity serialization.
 */
export const project = (events: Iterable<IdentityEventInput>): IdentityProjection => {
  const eventList = [...events];

  const observations: Array<IdentityObservation> = [];
  const assertions: Array<IdentityAssertion> = [];
  for (const event of eventList) {
    observations.push({ distinctId: event.distinctId, eventTs: event.eventTs });
    if (event.previousDistinctId !== undefined) {
      observations.push({ distinctId: event.previousDistinctId, eventTs: event.eventTs });
      if (event.previousDistinctId !== event.distinctId) {
        assertions.push({
          distinctIdA: event.previousDistinctId,
          distinctIdB: event.distinctId,
          eventTs: event.eventTs,
        });
      }
    }
  }

  const resolution = resolveIdentities({ assertions, observations });

  const writesByCanonical = new Map<string, Array<TraitWrite>>();
  const firstSeenByCanonical = new Map<string, number>();
  const lastSeenByCanonical = new Map<string, number>();
  const bestEmail = new Map<string, LwwCell>();
  const bestName = new Map<string, LwwCell>();

  const canonicalFor = (distinctId: string): string =>
    resolution.canonicalOf.get(distinctId) ?? distinctId;

  for (const event of eventList) {
    const canonical = canonicalFor(event.distinctId);

    const writes = writesByCanonical.get(canonical);
    const write: TraitWrite = {
      eventId: event.eventId,
      eventTs: event.eventTs,
      set: event.set,
      setOnce: event.setOnce,
    };
    if (writes) {
      writes.push(write);
    } else {
      writesByCanonical.set(canonical, [write]);
    }

    const currentFirst = firstSeenByCanonical.get(canonical);
    if (currentFirst === undefined || event.eventTs < currentFirst) {
      firstSeenByCanonical.set(canonical, event.eventTs);
    }
    const currentLast = lastSeenByCanonical.get(canonical);
    if (currentLast === undefined || event.eventTs > currentLast) {
      lastSeenByCanonical.set(canonical, event.eventTs);
    }

    if (event.email !== undefined) {
      const current = bestEmail.get(canonical);
      if (!current || isLater(event.eventTs, event.eventId, current.ts, current.id)) {
        bestEmail.set(canonical, { id: event.eventId, ts: event.eventTs, value: event.email });
      }
    }
    if (event.name !== undefined) {
      const current = bestName.get(canonical);
      if (!current || isLater(event.eventTs, event.eventId, current.ts, current.id)) {
        bestName.set(canonical, { id: event.eventId, ts: event.eventTs, value: event.name });
      }
    }
  }

  const persons = new Map<string, ResolvedPerson>();
  for (const [canonical, distinctIds] of resolution.membersOf) {
    const emailCell = bestEmail.get(canonical);
    const nameCell = bestName.get(canonical);
    persons.set(canonical, {
      canonicalDistinctId: canonical,
      distinctIds,
      firstSeenTs:
        firstSeenByCanonical.get(canonical) ?? resolution.firstSeenTs.get(canonical) ?? 0,
      lastSeenTs: lastSeenByCanonical.get(canonical) ?? resolution.firstSeenTs.get(canonical) ?? 0,
      traits: foldTraits(writesByCanonical.get(canonical) ?? []),
      ...(emailCell ? { email: emailCell.value as string } : {}),
      ...(nameCell ? { name: nameCell.value as string } : {}),
    });
  }

  return { canonicalOf: resolution.canonicalOf, persons };
};
