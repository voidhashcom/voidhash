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
  const insertedIds = new Set<string>();
  for (const node of target.nodes) {
    if (!liveById.has(node.id)) {
      insertedIds.add(node.id);
    }
  }
  const keptIds = new Set<string>();
  for (const node of target.nodes) {
    if (liveById.has(node.id)) {
      keptIds.add(node.id);
    }
  }

  // Precompute per-child placement (anchor / move / insert) with final
  // positions, for every target parent including the hidden root.
  const placement = computePlacements(targetChildren, liveById, liveChildren, generator);

  const inserts: Command[] = [];
  const moves: Command[] = [];
  const deletes: Command[] = [];
  const dataUpdates: Command[] = [];

  // Inserts — BFS over the target tree guarantees a parent is inserted before
  // its children (an inserted node's parent is either kept/root and already
  // present, or an inserted ancestor emitted earlier).
  for (const id of bfsOrder(targetChildren)) {
    if (!insertedIds.has(id)) {
      continue;
    }
    const node = targetById.get(id)!;
    const place = placement.get(id)!;
    inserts.push({
      kind: "tree.insert",
      path: treePath,
      node: { id: node.id, parent: node.parent, pos: place.pos, value: node.value },
    });
  }

  // Moves — kept nodes whose parent or sibling order changed. Emitted after all
  // inserts so every move target exists, and before deletes so a kept node
  // escapes a doomed parent before that parent is removed.
  for (const node of target.nodes) {
    if (!keptIds.has(node.id)) {
      continue;
    }
    const place = placement.get(node.id)!;
    if (place.kind === "move") {
      moves.push({
        kind: "tree.move",
        path: treePath,
        id: node.id,
        parent: node.parent,
        pos: place.pos,
      });
    }
  }

  // Deletes — live nodes absent from the target. Only the top-most node of each
  // removed subtree is emitted; the engine cascades to descendants.
  for (const node of live.nodes) {
    if (keptIds.has(node.id)) {
      continue;
    }
    const parentSurvives = node.parent === HiddenTreeRootId || keptIds.has(node.parent);
    if (parentSurvives) {
      deletes.push({ kind: "tree.delete", path: treePath, id: node.id });
    }
  }

  // Data — field-level diff of every kept node.
  for (const id of keptIds) {
    diffObject(
      treeNodePath(treePath, id),
      liveById.get(id)!.value,
      targetById.get(id)!.value,
      dataUpdates,
    );
  }

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
  targetChildren: Map<string, TreeNode[]>,
  liveById: Map<string, TreeNode>,
  liveChildren: Map<string, TreeNode[]>,
  generator: Generator,
): Map<string, Placement> {
  const placement = new Map<string, Placement>();

  for (const [parentId, kids] of targetChildren) {
    const liveKids = liveChildren.get(parentId) ?? [];
    const liveIndexById = new Map(liveKids.map((node, index) => [node.id, index]));

    // Children that stayed under this same parent, in target order, are the
    // anchor candidates; the LIS over their live indices is kept fixed.
    const stayedSameParent = kids
      .filter((kid) => liveById.has(kid.id) && liveIndexById.has(kid.id))
      .map((kid) => ({ id: kid.id, key: liveIndexById.get(kid.id)! }));
    const anchorIds = longestIncreasingSubsequence(stayedSameParent);

    // Next-anchor position lookahead for gap filling.
    const nextAnchorPos: (string | undefined)[] = new Array(kids.length);
    let upcoming: string | undefined;
    for (let i = kids.length - 1; i >= 0; i -= 1) {
      nextAnchorPos[i] = upcoming;
      if (anchorIds.has(kids[i]!.id)) {
        upcoming = liveById.get(kids[i]!.id)!.pos;
      }
    }

    // Every position currently occupied under this parent. A generated position
    // must avoid all of them: a reordered/incoming node's new pos is applied
    // while the still-present siblings (including nodes that only move in a later
    // command) hold their old positions, and the engine rejects a duplicate
    // sibling pos. Anchors keep their live pos (already in this set); non-anchors
    // are nudged strictly toward the upper bound until they land in a free slot.
    const takenPositions = new Set(liveKids.map((node) => node.pos));
    let prevPos: string | undefined;
    for (let i = 0; i < kids.length; i += 1) {
      const kid = kids[i]!;
      if (anchorIds.has(kid.id)) {
        const pos = liveById.get(kid.id)!.pos;
        placement.set(kid.id, { kind: "anchor", pos });
        prevPos = pos;
        continue;
      }
      const upper = nextAnchorPos[i];
      let pos = generator.between(prevPos, upper);
      for (let guard = 0; (takenPositions.has(pos) || pos === upper) && guard < 64; guard += 1) {
        pos = generator.between(pos, upper);
      }
      takenPositions.add(pos);
      placement.set(kid.id, { kind: liveById.has(kid.id) ? "move" : "insert", pos });
      prevPos = pos;
    }
  }

  return placement;
}

/**
 * Recursive field-level diff of two node object values, descending into nested
 * objects (e.g. `style`) to emit the narrowest `object.set` / `object.delete`.
 * The `type` discriminator is never diffed (identity guarantees it matches).
 * Arrays are compared by ordered content — ignoring CRDT item envelopes — so an
 * unchanged array (re-encoded with fresh item ids/positions) is a no-op.
 */
function diffObject(path: Path, live: ObjectValue, target: ObjectValue, out: Command[]): void {
  const keys = new Set<string>([...Object.keys(live.fields), ...Object.keys(target.fields)]);
  for (const key of keys) {
    if (key === TYPE_KEY) {
      continue;
    }
    const liveField = live.fields[key];
    const targetField = target.fields[key];
    if (targetField === undefined) {
      out.push({ kind: "object.delete", path, key });
      continue;
    }
    if (liveField === undefined) {
      out.push({ kind: "object.set", path, key, value: targetField });
      continue;
    }
    if (liveField.kind === "object" && targetField.kind === "object") {
      diffObject([...path, { kind: "field", key }], liveField, targetField, out);
      continue;
    }
    if (!valuesEqual(liveField, targetField)) {
      out.push({ kind: "object.set", path, key, value: targetField });
    }
  }
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
  switch (a.kind) {
    case "string":
      return a.value === (b as typeof a).value;
    case "number":
      return a.value === (b as typeof a).value;
    case "boolean":
      return a.value === (b as typeof a).value;
    case "object": {
      const bObj = b as ObjectValue;
      const aKeys = Object.keys(a.fields);
      if (aKeys.length !== Object.keys(bObj.fields).length) {
        return false;
      }
      return aKeys.every(
        (key) => bObj.fields[key] !== undefined && valuesEqual(a.fields[key]!, bObj.fields[key]!),
      );
    }
    case "array": {
      const bArr = b as typeof a;
      if (a.items.length !== bArr.items.length) {
        return false;
      }
      const aOrdered = orderedItems(a.items);
      const bOrdered = orderedItems(bArr.items);
      return aOrdered.every((item, index) => valuesEqual(item.value, bOrdered[index]!.value));
    }
    case "tree": {
      // Node data never nests a tree; compare defensively by ordered structure.
      const bTree = b as typeof a;
      if (a.nodes.length !== bTree.nodes.length) {
        return false;
      }
      const key = (node: TreeNode): string => `${node.parent} ${node.id}`;
      const bByKey = new Map(bTree.nodes.map((node) => [key(node), node]));
      return a.nodes.every((node) => {
        const other = bByKey.get(key(node));
        return other !== undefined && valuesEqual(node.value, other.value);
      });
    }
  }
}

const orderedItems = (items: readonly ArrayItem[]): ArrayItem[] =>
  [...items].sort(compareArrayItems);

const indexById = (tree: TreeValue): Map<string, TreeNode> =>
  new Map(tree.nodes.map((node) => [node.id, node]));

const groupChildren = (tree: TreeValue): Map<string, TreeNode[]> => {
  const byParent = new Map<string, TreeNode[]>();
  for (const node of tree.nodes) {
    const list = byParent.get(node.parent);
    if (list) {
      list.push(node);
    } else {
      byParent.set(node.parent, [node]);
    }
  }
  for (const list of byParent.values()) {
    list.sort(compareTreeSiblings);
  }
  return byParent;
};

const bfsOrder = (targetChildren: Map<string, TreeNode[]>): string[] => {
  const order: string[] = [];
  const queue = (targetChildren.get(HiddenTreeRootId) ?? []).map((node) => node.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of targetChildren.get(id) ?? []) {
      queue.push(child.id);
    }
  }
  return order;
};

const treeNodePath = (treePath: Path, nodeId: string): Path => [
  ...treePath,
  { kind: "node", id: nodeId },
];

/**
 * Ids of one longest strictly-increasing subsequence (by `key`) — the anchors
 * that keep their live position. O(n log n) patience sorting with predecessor
 * links for reconstruction.
 */
function longestIncreasingSubsequence(items: readonly { id: string; key: number }[]): Set<string> {
  const result = new Set<string>();
  if (items.length === 0) {
    return result;
  }
  const tails: number[] = [];
  const prev: number[] = new Array(items.length).fill(-1);
  for (let i = 0; i < items.length; i += 1) {
    const key = items[i]!.key;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[tails[mid]!]!.key < key) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo > 0) {
      prev[i] = tails[lo - 1]!;
    }
    if (lo === tails.length) {
      tails.push(i);
    } else {
      tails[lo] = i;
    }
  }
  let cursor = tails[tails.length - 1]!;
  while (cursor !== -1) {
    result.add(items[cursor]!.id);
    cursor = prev[cursor]!;
  }
  return result;
}
