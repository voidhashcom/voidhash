import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
/**
 * Order-agnostic identity resolution — the pure core of the event-sourced
 * identity model.
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
  readonly canonicalOf: HashMap.HashMap<string, string>;
  /** Canonical distinct id mapped to its sorted component members. */
  readonly membersOf: HashMap.HashMap<string, ReadonlyArray<string>>;
  /** Per distinct id, the earliest event timestamp it was seen at. */
  readonly firstSeenTs: HashMap.HashMap<string, number>;
}

/** Lexicographic, locale-independent string order for deterministic results. */
const compareString = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

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
  const see = (
    firstSeen: HashMap.HashMap<string, number>,
    distinctId: string,
    eventTs: number,
  ): HashMap.HashMap<string, number> =>
    HashMap.modifyAt(firstSeen, distinctId, (current) =>
      Option.some(
        Math.min(
          eventTs,
          Option.getOrElse(current, () => eventTs),
        ),
      ),
    );

  const firstSeenFromObservations = Arr.reduce(
    Arr.fromIterable(observations ?? []),
    HashMap.empty<string, number>(),
    (firstSeen, observation) => see(firstSeen, observation.distinctId, observation.eventTs),
  );
  const assertionList = Arr.fromIterable(assertions ?? []);
  const firstSeen = Arr.reduce(assertionList, firstSeenFromObservations, (current, assertion) =>
    see(
      see(current, assertion.distinctIdA, assertion.eventTs),
      assertion.distinctIdB,
      assertion.eventTs,
    ),
  );
  const edges = Arr.flatMap(assertionList, (assertion) =>
    assertion.distinctIdA === assertion.distinctIdB
      ? []
      : [[assertion.distinctIdA, assertion.distinctIdB] as const],
  );

  // Union-find. Every key's sort order is fully known before unioning, so the
  // root that survives each union is always the component minimum.
  let parent = HashMap.map(firstSeen, (_, distinctId) => distinctId);

  const findRoot = (start: string): string => {
    const next = Option.getOrElse(HashMap.get(parent, start), () => start);
    if (next === start) {
      return start;
    }
    const root = findRoot(next);
    parent = HashMap.set(parent, start, root);
    return root;
  };

  const compareKey = (left: string, right: string): number => {
    const leftTs = Option.getOrElse(HashMap.get(firstSeen, left), () => 0);
    const rightTs = Option.getOrElse(HashMap.get(firstSeen, right), () => 0);
    if (leftTs !== rightTs) {
      return leftTs - rightTs;
    }
    return compareString(left, right);
  };

  parent = Arr.reduce(edges, parent, (currentParent, [a, b]) => {
    parent = currentParent;
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA === rootB) {
      return parent;
    }
    // Smaller key becomes the parent → the surviving root is the component min.
    return compareKey(rootA, rootB) <= 0
      ? HashMap.set(parent, rootB, rootA)
      : HashMap.set(parent, rootA, rootB);
  });

  const [canonicalOf, members] = Arr.reduce(
    Arr.fromIterable(HashMap.keys(firstSeen)),
    [HashMap.empty<string, string>(), HashMap.empty<string, ReadonlyArray<string>>()] as const,
    ([canonicalOf, members], distinctId) => {
      const root = findRoot(distinctId);
      return [
        HashMap.set(canonicalOf, distinctId, root),
        HashMap.modifyAt(members, root, (current) =>
          Option.some([...Option.getOrElse(current, () => []), distinctId]),
        ),
      ] as const;
    },
  );

  const membersOf = HashMap.map(members, (list) => Arr.sort(list, Order.String));

  return { canonicalOf, firstSeenTs: firstSeen, membersOf };
};

/** The birth coordinates of a person, used to pick a merge survivor. */
export interface PersonSeniority {
  readonly id: string;
  readonly firstSeenAt: Option.Option<Date>;
  readonly createdAt: Option.Option<Date>;
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
  const timestamp = (person: PersonSeniority): number =>
    Option.orElse(person.firstSeenAt, () => person.createdAt).pipe(
      Option.map((date) => date.getTime()),
      Option.getOrElse(() => 0),
    );
  const leftTs = timestamp(left);
  const rightTs = timestamp(right);
  if (leftTs !== rightTs) {
    return leftTs - rightTs;
  }
  return compareString(left.id, right.id);
};

/** One `(distinctId → person)` row, used to rebuild the projection from the log. */
export interface DistinctIdMapping {
  readonly distinctId: string;
  readonly person: PersonSeniority;
}

/** The recomputed projection produced by {@link planProjectionRebuild}. */
export interface RebuildPlan {
  /** Every distinct id mapped to the canonical person id it should resolve to. */
  readonly canonicalPersonOf: HashMap.HashMap<string, string>;
  /** Each non-canonical person id mapped to the person it should merge into. */
  readonly mergedInto: HashMap.HashMap<string, string>;
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
  const mappingList = Arr.fromIterable(input.mappings);
  const personByDistinct = HashMap.fromIterable(
    Arr.map(mappingList, (mapping) => [mapping.distinctId, mapping.person] as const),
  );
  const observations = Arr.map(
    mappingList,
    (mapping): IdentityObservation => ({
      distinctId: mapping.distinctId,
      eventTs: Option.orElse(mapping.person.firstSeenAt, () => mapping.person.createdAt).pipe(
        Option.map((date) => date.getTime()),
        Option.getOrElse(() => 0),
      ),
    }),
  );

  const resolution = resolveIdentities({ assertions: input.assertions, observations });

  const [canonicalPersonOf, mergedInto] = Arr.reduce(
    Arr.fromIterable(HashMap.values(resolution.membersOf)),
    [HashMap.empty<string, string>(), HashMap.empty<string, string>()] as const,
    ([canonicalPersonOf, mergedInto], members) => {
      const personsInComponent = HashMap.fromIterable(
        Arr.flatMap(members, (distinctId) =>
          Arr.fromOption(
            HashMap.get(personByDistinct, distinctId).pipe(
              Option.map((person) => [person.id, person] as const),
            ),
          ),
        ),
      );
      const canonical = Arr.reduce(
        Arr.fromIterable(HashMap.values(personsInComponent)),
        Option.none<PersonSeniority>(),
        (current, person) =>
          Option.match(current, {
            onNone: () => Option.some(person),
            onSome: (selected) =>
              Option.some(comparePersonForMerge(person, selected) < 0 ? person : selected),
          }),
      );

      return Option.match(canonical, {
        onNone: () => [canonicalPersonOf, mergedInto] as const,
        onSome: (selected) =>
          [
            Arr.reduce(members, canonicalPersonOf, (result, distinctId) =>
              HashMap.has(personByDistinct, distinctId)
                ? HashMap.set(result, distinctId, selected.id)
                : result,
            ),
            Arr.reduce(
              Arr.fromIterable(HashMap.values(personsInComponent)),
              mergedInto,
              (result, person) =>
                person.id === selected.id ? result : HashMap.set(result, person.id, selected.id),
            ),
          ] as const,
      });
    },
  );

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

interface LwwCell<A = unknown> {
  readonly ts: number;
  readonly id: string;
  readonly value: A;
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
  const select = (
    cells: HashMap.HashMap<string, LwwCell>,
    entries: ReadonlyArray<readonly [string, unknown]>,
    write: TraitWrite,
    wins: (current: LwwCell) => boolean,
  ): HashMap.HashMap<string, LwwCell> =>
    Arr.reduce(entries, cells, (result, [key, value]) =>
      HashMap.modifyAt(result, key, (current) =>
        Option.match(current, {
          onNone: () => Option.some({ id: write.eventId, ts: write.eventTs, value }),
          onSome: (cell) =>
            wins(cell)
              ? Option.some({ id: write.eventId, ts: write.eventTs, value })
              : Option.some(cell),
        }),
      ),
    );

  const [bestSet, bestSetOnce] = Arr.reduce(
    Arr.fromIterable(writes),
    [HashMap.empty<string, LwwCell>(), HashMap.empty<string, LwwCell>()] as const,
    ([bestSet, bestSetOnce], write) => [
      select(bestSet, R.toEntries(write.set ?? {}), write, (current) =>
        isLater(write.eventTs, write.eventId, current.ts, current.id),
      ),
      select(bestSetOnce, R.toEntries(write.setOnce ?? {}), write, (current) =>
        isLater(current.ts, current.id, write.eventTs, write.eventId),
      ),
    ],
  );

  const emptyResolved: Record<string, unknown> = {};
  return Arr.reduce(
    [...HashMap.toEntries(bestSetOnce), ...HashMap.toEntries(bestSet)],
    emptyResolved,
    (resolved, [key, cell]) => ({ ...resolved, [key]: cell.value }),
  );
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
  const applyEntries = (
    current: TraitFoldState,
    entries: ReadonlyArray<readonly [string, unknown]>,
    mode: TraitMetaCell["mode"],
    wins: (cell: TraitMetaCell) => boolean,
  ): TraitFoldState =>
    Arr.reduce(entries, current, (result, [key, value]) => {
      const cell = result.meta[key];
      if (cell && !wins(cell)) {
        return result;
      }
      return {
        meta: {
          ...result.meta,
          [key]: { id: write.eventId, mode, ts: write.eventTs },
        },
        traits: { ...result.traits, [key]: value },
      };
    });

  const withSetOnce = applyEntries(
    state,
    R.toEntries(write.setOnce ?? {}),
    "setOnce",
    (cell) => cell.mode === "setOnce" && isLater(cell.ts, cell.id, write.eventTs, write.eventId),
  );
  return applyEntries(
    withSetOnce,
    R.toEntries(write.set ?? {}),
    "set",
    (cell) => cell.mode === "setOnce" || isLater(write.eventTs, write.eventId, cell.ts, cell.id),
  );
};

/**
 * Lifts a stored `(traits, meta)` pair into a {@link TraitFoldState},
 * synthesizing a floor meta cell for any legacy trait key that predates
 * per-trait metadata. The floor (`ts: 0`, `mode: "set"`) preserves the value
 * through {@link combineTraitStates} yet loses to any real write.
 */
export const materializeTraitState = (
  traits: Option.Option<Readonly<Record<string, unknown>>>,
  meta: Option.Option<Readonly<TraitsMeta>>,
): TraitFoldState => {
  const nextTraits = { ...Option.getOrElse(traits, () => ({})) };
  const initialMeta: TraitsMeta = { ...Option.getOrElse(meta, () => ({})) };
  const nextMeta = Arr.reduce(R.keys(nextTraits), initialMeta, (result, key) =>
    result[key] ? result : { ...result, [key]: { id: "", mode: "set" as const, ts: 0 } },
  );
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
  const keys = HashSet.fromIterable([...R.keys(left.meta), ...R.keys(right.meta)]);
  const initial: TraitFoldState = { meta: {}, traits: {} };
  return Arr.reduce(Arr.fromIterable(keys), initial, (result, key) => {
    const leftCell = left.meta[key];
    const rightCell = right.meta[key];
    const selected =
      leftCell && rightCell
        ? traitCellWins(leftCell, rightCell)
          ? Option.some([leftCell, left.traits[key]] as const)
          : Option.some([rightCell, right.traits[key]] as const)
        : leftCell
          ? Option.some([leftCell, left.traits[key]] as const)
          : rightCell
            ? Option.some([rightCell, right.traits[key]] as const)
            : Option.none();
    return Option.match(selected, {
      onNone: () => result,
      onSome: ([cell, value]) => ({
        meta: { ...result.meta, [key]: cell },
        traits: { ...result.traits, [key]: value },
      }),
    });
  });
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

/** Only the LWW-resolved profile fields that an event actually wrote. */
const identityLwwFields = ({
  emailCell,
  nameCell,
}: {
  readonly emailCell: Option.Option<LwwCell<string>>;
  readonly nameCell: Option.Option<LwwCell<string>>;
}): { email?: string; name?: string } => {
  const email = Option.match(emailCell, {
    onNone: () => ({}),
    onSome: (cell) => ({ email: cell.value }),
  });
  return Option.match(nameCell, {
    onNone: () => email,
    onSome: (cell) => ({ ...email, name: cell.value }),
  });
};

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
  readonly canonicalOf: HashMap.HashMap<string, string>;
  /** Canonical distinct id mapped to the resolved person. */
  readonly persons: HashMap.HashMap<string, ResolvedPerson>;
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
  const eventList = Arr.fromIterable(events);

  const observations = Arr.flatMap(
    eventList,
    (event): ReadonlyArray<IdentityObservation> => [
      { distinctId: event.distinctId, eventTs: event.eventTs },
      ...(event.previousDistinctId === undefined
        ? []
        : [{ distinctId: event.previousDistinctId, eventTs: event.eventTs }]),
    ],
  );
  const assertions = Arr.flatMap(eventList, (event) =>
    event.previousDistinctId === undefined || event.previousDistinctId === event.distinctId
      ? []
      : [
          {
            distinctIdA: event.previousDistinctId,
            distinctIdB: event.distinctId,
            eventTs: event.eventTs,
          },
        ],
  );

  const resolution = resolveIdentities({ assertions, observations });

  const canonicalFor = (distinctId: string): string =>
    Option.getOrElse(HashMap.get(resolution.canonicalOf, distinctId), () => distinctId);

  const state = Arr.reduce(
    eventList,
    {
      bestEmail: HashMap.empty<string, LwwCell<string>>(),
      bestName: HashMap.empty<string, LwwCell<string>>(),
      firstSeenByCanonical: HashMap.empty<string, number>(),
      lastSeenByCanonical: HashMap.empty<string, number>(),
      writesByCanonical: HashMap.empty<string, ReadonlyArray<TraitWrite>>(),
    },
    (state, event) => {
      const canonical = canonicalFor(event.distinctId);
      const write: TraitWrite = {
        eventId: event.eventId,
        eventTs: event.eventTs,
        set: event.set,
        setOnce: event.setOnce,
      };
      const updateProfile = (
        cells: HashMap.HashMap<string, LwwCell<string>>,
        value: Option.Option<string>,
      ): HashMap.HashMap<string, LwwCell<string>> =>
        Option.match(value, {
          onNone: () => cells,
          onSome: (value) =>
            HashMap.modifyAt(cells, canonical, (current) =>
              Option.match(current, {
                onNone: () => Option.some({ id: event.eventId, ts: event.eventTs, value }),
                onSome: (cell) =>
                  isLater(event.eventTs, event.eventId, cell.ts, cell.id)
                    ? Option.some({ id: event.eventId, ts: event.eventTs, value })
                    : Option.some(cell),
              }),
            ),
        });
      return {
        bestEmail: updateProfile(state.bestEmail, Option.fromNullishOr(event.email)),
        bestName: updateProfile(state.bestName, Option.fromNullishOr(event.name)),
        firstSeenByCanonical: HashMap.modifyAt(state.firstSeenByCanonical, canonical, (current) =>
          Option.some(
            Math.min(
              event.eventTs,
              Option.getOrElse(current, () => event.eventTs),
            ),
          ),
        ),
        lastSeenByCanonical: HashMap.modifyAt(state.lastSeenByCanonical, canonical, (current) =>
          Option.some(
            Math.max(
              event.eventTs,
              Option.getOrElse(current, () => event.eventTs),
            ),
          ),
        ),
        writesByCanonical: HashMap.modifyAt(state.writesByCanonical, canonical, (current) =>
          Option.some([...Option.getOrElse(current, () => []), write]),
        ),
      };
    },
  );

  const persons = HashMap.map(resolution.membersOf, (distinctIds, canonical): ResolvedPerson => {
    const fallbackFirstSeen = Option.getOrElse(
      HashMap.get(resolution.firstSeenTs, canonical),
      () => 0,
    );
    return {
      canonicalDistinctId: canonical,
      distinctIds,
      firstSeenTs: Option.getOrElse(
        HashMap.get(state.firstSeenByCanonical, canonical),
        () => fallbackFirstSeen,
      ),
      lastSeenTs: Option.getOrElse(
        HashMap.get(state.lastSeenByCanonical, canonical),
        () => fallbackFirstSeen,
      ),
      traits: foldTraits(
        Option.getOrElse(HashMap.get(state.writesByCanonical, canonical), () => []),
      ),
      ...identityLwwFields({
        emailCell: HashMap.get(state.bestEmail, canonical),
        nameCell: HashMap.get(state.bestName, canonical),
      }),
    };
  });

  return { canonicalOf: resolution.canonicalOf, persons };
};
