import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import { pick } from "@voidhash/lib/lang";
import {
  compareArrayItems,
  compareTreeSiblings,
  createGenerator,
  HiddenTreeRootId,
  type ArrayItem,
  type Command,
  type Generator,
  type ObjectValue,
  type Path,
  type TreeNode,
  type TreeValue,
  type Value,
} from "@voidhash/mimic-core";

const TYPE_KEY = "type";

class ReconcileInvariantError extends Error {
  readonly _tag = "ReconcileInvariantError";
}

const required = <A>(value: Option.Option<A>, message: string): A => {
  if (Option.isNone(value)) {
    throw new ReconcileInvariantError(message);
  }
  return value.value;
};

export interface ReconcileOptions {
  /**
   * Path to the tree value within the document root. Defaults to `[]` for a
   * document whose root value *is* the tree (the paywall designer document).
   */
  readonly treePath?: Path;
  /**
   * Position generator for newly-inserted / moved nodes. Defaults to the
   * jittered generator (matching the live editor), which makes sibling-position
   * collisions astronomically unlikely. Tests may inject a deterministic one.
   */
  readonly generator?: Generator;
}

/**
 * Diff a live mimic tree against a target tree and emit the minimal set of CRDT
 * commands that turns `live` into `target`.
 *
 * The core round-trip primitive of the paywall composition pipeline. Both trees
 * are matched by node `id`; a node present in both keeps its identity (and, when
 * its sibling order is unchanged, its fractional `pos` — so a no-op reconcile
 * emits zero commands and a code push merges into a live document instead of
 * clobbering it). Ordering of the returned commands is safe to apply
 * sequentially: inserts (parents before children) → moves → deletes → data
 * updates.
 *
 * Identity contract: a node's `id` is stable across the round-trip and `type`
 * is part of identity — changing a node's type is expressed as a new id (delete
 * + insert), never an in-place retype. `pos` is never carried in the target;
 * order is derived from target sibling order.
 */
export function reconcile(
  live: TreeValue,
  target: TreeValue,
  options: ReconcileOptions = {},
): Command[] {
  const treePath = options.treePath ?? [];
  const generator = options.generator ?? createGenerator();

  const liveById = indexById(live);
  const targetById = indexById(target);
  const liveChildren = groupChildren(live);
  const targetChildren = groupChildren(target);

  // A target node is a fresh insert iff its id is absent from the live tree.
  // Everything present in both is "kept" (its identity — and its own kept
  // children — survive; it may still move parents or reorder). Type is part of
  // identity, so a retype arrives as a new id and is therefore an insert here.
  const insertedIds = HashSet.fromIterable(
    target.nodes.filter((node) => !HashMap.has(liveById, node.id)).map((node) => node.id),
  );
  const keptIds = HashSet.fromIterable(
    target.nodes.filter((node) => HashMap.has(liveById, node.id)).map((node) => node.id),
  );

  // Precompute per-child placement (anchor / move / insert) with final
  // positions, for every target parent including the hidden root.
  const placement = computePlacements(targetChildren, liveById, liveChildren, generator);

  const inserts = Arr.flatMap(bfsOrder(targetChildren), (id): Command[] => {
    if (!HashSet.has(insertedIds, id)) {
      return [];
    }
    const node = required(HashMap.get(targetById, id), `missing target node ${id}`);
    const place = required(HashMap.get(placement, id), `missing placement for ${id}`);
    return [
      {
        kind: "tree.insert",
        path: treePath,
        node: { id: node.id, parent: node.parent, pos: place.pos, value: node.value },
      },
    ];
  });
  const moves = Arr.flatMap(target.nodes, (node): Command[] => {
    if (!HashSet.has(keptIds, node.id)) {
      return [];
    }
    const place = required(HashMap.get(placement, node.id), `missing placement for ${node.id}`);
    return place.kind === "move"
      ? [
          {
            kind: "tree.move",
            path: treePath,
            id: node.id,
            parent: node.parent,
            pos: place.pos,
          },
        ]
      : [];
  });
  const deletes = Arr.flatMap(live.nodes, (node): Command[] => {
    if (HashSet.has(keptIds, node.id)) {
      return [];
    }
    const parentSurvives = node.parent === HiddenTreeRootId || HashSet.has(keptIds, node.parent);
    return parentSurvives ? [{ kind: "tree.delete", path: treePath, id: node.id }] : [];
  });
  const dataUpdates: Command[] = [];

  // Data — field-level diff of every kept node.
  Arr.forEach([...keptIds], (id) => {
    diffObject(
      treeNodePath(treePath, id),
      required(HashMap.get(liveById, id), `missing live node ${id}`).value,
      required(HashMap.get(targetById, id), `missing target node ${id}`).value,
      dataUpdates,
    );
  });

  return [...inserts, ...moves, ...deletes, ...dataUpdates];
}

interface Placement {
  readonly kind: "anchor" | "move" | "insert";
  readonly pos: string;
}

/**
 * For each target parent, decide which children keep their live position
 * (anchors), which reorder/reparent (moves), and which are new (inserts), and
 * assign fractional positions to the non-anchors between the surrounding
 * anchors. Anchors are the longest strictly-increasing subsequence (by live
 * order) of children that stayed under the same parent — keeping them fixed is
 * what makes an unchanged subtree emit zero commands.
 */
function computePlacements(
  targetChildren: HashMap.HashMap<string, TreeNode[]>,
  liveById: HashMap.HashMap<string, TreeNode>,
  liveChildren: HashMap.HashMap<string, TreeNode[]>,
  generator: Generator,
): HashMap.HashMap<string, Placement> {
  return Arr.reduce(
    [...targetChildren],
    HashMap.empty<string, Placement>(),
    (placement, [parentId, kids]) => {
      const liveKids = Option.getOrElse(HashMap.get(liveChildren, parentId), () => []);
      const liveIndexById = HashMap.fromIterable(
        liveKids.map((node, index) => [node.id, index] as const),
      );

      const stayedSameParent: IncreasingItem[] = Arr.flatMap(kids, (kid) =>
        HashMap.has(liveById, kid.id) && HashMap.has(liveIndexById, kid.id)
          ? [
              {
                id: kid.id,
                key: required(HashMap.get(liveIndexById, kid.id), `missing index for ${kid.id}`),
              },
            ]
          : [],
      );
      const anchorIds = longestIncreasingSubsequence(stayedSameParent);

      const initial = {
        placement,
        takenPositions: HashSet.fromIterable(liveKids.map((node) => node.pos)),
        previousPosition: Option.none<string>(),
      };
      return Arr.reduce(kids, initial, (state, kid, index) => {
        if (HashSet.has(anchorIds, kid.id)) {
          const pos = required(HashMap.get(liveById, kid.id), `missing anchor ${kid.id}`).pos;
          const anchorPlacement: Placement = { kind: "anchor", pos };
          return {
            ...state,
            placement: HashMap.set(state.placement, kid.id, anchorPlacement),
            previousPosition: Option.some(pos),
          };
        }
        const upper = Arr.findFirst(kids.slice(index + 1), (candidate) =>
          HashSet.has(anchorIds, candidate.id),
        ).pipe(
          Option.flatMap((anchor) => HashMap.get(liveById, anchor.id)),
          Option.map((anchor) => anchor.pos),
        );
        const pos = findFreePosition(
          generator,
          state.previousPosition,
          upper,
          state.takenPositions,
        );
        const nextPlacement: Placement = {
          kind: pick(HashMap.has(liveById, kid.id), "move", "insert"),
          pos,
        };
        return {
          placement: HashMap.set(state.placement, kid.id, nextPlacement),
          takenPositions: HashSet.add(state.takenPositions, pos),
          previousPosition: Option.some(pos),
        };
      }).placement;
    },
  );
}

const findFreePosition = (
  generator: Generator,
  lower: Option.Option<string>,
  upper: Option.Option<string>,
  taken: HashSet.HashSet<string>,
  guard = 0,
): string => {
  const pos = generator.between(Option.getOrUndefined(lower), Option.getOrUndefined(upper));
  if (
    guard < 64 &&
    (HashSet.has(taken, pos) || Option.exists(upper, (upperPosition) => upperPosition === pos))
  ) {
    return findFreePosition(generator, Option.some(pos), upper, taken, guard + 1);
  }
  return pos;
};

/**
 * Recursive field-level diff of two node object values, descending into nested
 * objects (e.g. `style`) to emit the narrowest `object.set` / `object.delete`.
 * The `type` discriminator is never diffed (identity guarantees it matches).
 * Arrays are compared by ordered content — ignoring CRDT item envelopes — so an
 * unchanged array (re-encoded with fresh item ids/positions) is a no-op.
 */
function diffObject(path: Path, live: ObjectValue, target: ObjectValue, out: Command[]): void {
  const keys = HashSet.fromIterable([...R.keys(live.fields), ...R.keys(target.fields)]);
  Arr.forEach([...keys], (key) => {
    if (key === TYPE_KEY) {
      return;
    }
    const liveField = live.fields[key];
    const targetField = target.fields[key];
    if (targetField === undefined) {
      out.push({ kind: "object.delete", path, key });
      return;
    }
    if (liveField === undefined) {
      out.push({ kind: "object.set", path, key, value: targetField });
      return;
    }
    if (liveField.kind === "object" && targetField.kind === "object") {
      diffObject([...path, { kind: "field", key }], liveField, targetField, out);
      return;
    }
    if (!valuesEqual(liveField, targetField)) {
      out.push({ kind: "object.set", path, key, value: targetField });
    }
  });
}

/** Structural value equality that ignores array-item CRDT envelopes (id/pos). */
export function structuralValueEquals(a: Value, b: Value): boolean {
  return valuesEqual(a, b);
}

/** Structural value equality that ignores array-item CRDT envelopes (id/pos). */
function valuesEqual(a: Value, b: Value): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "string" && b.kind === "string") {
    return a.value === b.value;
  }
  if (a.kind === "number" && b.kind === "number") {
    return a.value === b.value;
  }
  if (a.kind === "boolean" && b.kind === "boolean") {
    return a.value === b.value;
  }
  if (a.kind === "object" && b.kind === "object") {
    const aKeys = R.keys(a.fields);
    if (aKeys.length !== R.keys(b.fields).length) {
      return false;
    }
    return aKeys.every((key) => {
      const left = Option.fromUndefinedOr(a.fields[key]);
      const right = Option.fromUndefinedOr(b.fields[key]);
      return Option.isSome(left) && Option.isSome(right) && valuesEqual(left.value, right.value);
    });
  }
  if (a.kind === "array" && b.kind === "array") {
    if (a.items.length !== b.items.length) {
      return false;
    }
    const aOrdered = orderedItems(a.items);
    const bOrdered = orderedItems(b.items);
    return aOrdered.every((item, index) =>
      Option.exists(Arr.get(bOrdered, index), (other) => valuesEqual(item.value, other.value)),
    );
  }
  if (a.kind === "tree" && b.kind === "tree") {
    // Node data never nests a tree; compare defensively by ordered structure.
    if (a.nodes.length !== b.nodes.length) {
      return false;
    }
    const key = (node: TreeNode): string => `${node.parent} ${node.id}`;
    const bByKey = HashMap.fromIterable(b.nodes.map((node) => [key(node), node]));
    return a.nodes.every((node) => {
      return Option.exists(HashMap.get(bByKey, key(node)), (other) =>
        valuesEqual(node.value, other.value),
      );
    });
  }
  return false;
}

const orderedItems = (items: readonly ArrayItem[]): ArrayItem[] =>
  Arr.sort(
    items,
    Order.make<ArrayItem>((self, that) => {
      const comparison = compareArrayItems(self, that);
      return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
    }),
  );

const indexById = (tree: TreeValue): HashMap.HashMap<string, TreeNode> =>
  HashMap.fromIterable(tree.nodes.map((node) => [node.id, node]));

const groupChildren = (tree: TreeValue): HashMap.HashMap<string, TreeNode[]> =>
  HashMap.map(
    Arr.reduce(tree.nodes, HashMap.empty<string, TreeNode[]>(), (byParent, node) =>
      HashMap.set(byParent, node.parent, [
        ...Option.getOrElse(HashMap.get(byParent, node.parent), () => []),
        node,
      ]),
    ),
    (nodes) =>
      Arr.sort(
        nodes,
        Order.make<TreeNode>((self, that) => {
          const comparison = compareTreeSiblings(self, that);
          return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
        }),
      ),
  );

const bfsOrder = (targetChildren: HashMap.HashMap<string, TreeNode[]>): string[] => {
  const visit = (queue: readonly string[], order: readonly string[]): string[] => {
    const head = Arr.head(queue);
    if (Option.isNone(head)) {
      return [...order];
    }
    const children = Option.getOrElse(HashMap.get(targetChildren, head.value), () => []);
    return visit([...queue.slice(1), ...children.map((node) => node.id)], [...order, head.value]);
  };
  const roots = Option.getOrElse(HashMap.get(targetChildren, HiddenTreeRootId), () => []);
  return visit(
    roots.map((node) => node.id),
    [],
  );
};

const treeNodePath = (treePath: Path, nodeId: string): Path => [
  ...treePath,
  { kind: "node", id: nodeId },
];

/**
 * Ids of one longest strictly-increasing subsequence (by `key`) — the anchors
 * that keep their live position. Uses a straightforward dynamic-programming
 * pass because sibling groups are small.
 */
interface IncreasingItem {
  readonly id: string;
  readonly key: number;
}

function longestIncreasingSubsequence(items: readonly IncreasingItem[]): HashSet.HashSet<string> {
  const emptySequence: readonly IncreasingItem[] = [];
  const emptySequences: readonly (readonly IncreasingItem[])[] = [];
  const sequences = Arr.reduce(items, emptySequences, (completed, item) => {
    const candidates = completed.filter((sequence) =>
      Option.exists(Arr.last(sequence), (tail) => tail.key < item.key),
    );
    const best = Arr.reduce(candidates, emptySequence, (a, b) => (b.length > a.length ? b : a));
    return [...completed, [...best, item]];
  });
  const longest = Arr.reduce(sequences, emptySequence, (a, b) => (b.length > a.length ? b : a));
  return HashSet.fromIterable(longest.map((item) => item.id));
}
