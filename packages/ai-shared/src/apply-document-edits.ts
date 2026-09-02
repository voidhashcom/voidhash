import { shortId } from "@voidhash/mimic-core";

import type { EditableDocumentNode } from "./document-edits.ts";
import type { DocumentEdit, MintedIds, NodeInput } from "./surfaces.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

interface MutableIndex<K, V> {
  readonly get: (key: K) => V | void;
  readonly set: (key: K, value: V) => void;
  readonly delete: (key: K) => void;
  readonly has: (key: K) => boolean;
}

const makeMutableIndex = <K, V>(): MutableIndex<K, V> => {
  const backing = MutableHashMap.empty<K, V>();
  return {
    get: (key) => Option.getOrUndefined(MutableHashMap.get(backing, key)),
    set: (key, value) => {
      MutableHashMap.set(backing, key, value);
    },
    delete: (key) => {
      MutableHashMap.remove(backing, key);
    },
    has: (key) => MutableHashMap.has(backing, key),
  };
};

/**
 * A pure document-edit applier: given a decoded document tree and a batch of
 * ALREADY-VALIDATED {@link DocumentEdit} ops, produce the resulting target tree
 * plus the ids minted for every node an `insert` / `replaceChildren` created.
 *
 * This is the server-side twin of the browser store action `applyDocumentEdits`
 * (apps/www .../document-edit-actions.ts): the browser applies the ops to the
 * LIVE mimic proxy (which mints ids and merges as a side effect), while this
 * runs the SAME op semantics purely so the backend can pre-mint ids, build a
 * target tree, and reconcile it against the live document (no fork, no whole-
 * target overwrite). The two share the ai-shared validator + these op shapes, so
 * they converge on identical behavior — see the report note on unifying them.
 *
 * Semantics mirrored from the mimic write path (see the `emitStructUpdate`
 * merge in mimic-core `Struct.ts` and the store action):
 * - `insert` — add a subtree under `parentId` at the (already-clamped) `index`;
 *   every created node gets a pre-minted {@link shortId} id, collected pre-order
 *   (parent before children) into the minted-id map keyed by op index.
 * - `update` — deep-MERGE the `set` into the node's `data`: when both the
 *   existing and incoming value at a key are plain (non-array) objects, merge
 *   per-field recursively (nested structs like `style`); everything else (arrays,
 *   scalars, a plain object replacing a non-object) REPLACES wholesale. An
 *   `undefined` value deletes the field.
 * - `move` — reparent the node under `parentId` at `index` (identity preserved).
 * - `remove` — drop the node and its subtree.
 * - `replaceChildren` — replace the node's whole child list with a new ordered
 *   list; the removed subtree is dropped and the new nodes are minted.
 *
 * Pre-minted ids survive the round-trip: `PaywallDesignerDocument.encode`
 * preserves any `id` present on an input node (minting only when absent), and
 * `reconcile` emits a `tree.insert` carrying the TARGET id verbatim for any node
 * id absent from the live tree — so a pre-minted id becomes the node's real,
 * addressable id. `shortId` is the exact generator mimic uses for tree node ids.
 *
 * The applier assumes the ops already passed {@link validateDocumentEdits}: an
 * op that addresses a now-missing node (which validation would have rejected) is
 * skipped defensively rather than throwing.
 */
export interface ApplyDocumentEditsResult {
  /** The resulting target tree (same root identity, edits applied). */
  readonly root: EditableDocumentNode;
  /**
   * Minted ids per op: the batch index of each `insert` / `replaceChildren` op
   * (as a string) → the ids minted for the nodes it created, pre-order
   * (parents before children). Matches ai-shared's {@link MintedIds} wire shape.
   */
  readonly mintedIds: MintedIds;
}

/** A mutable node during application (a deep, mutable copy of the input tree). */
interface MutableNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  children: MutableNode[];
}

/**
 * Apply a validated batch of document edits to a copy of `root`, returning the
 * new tree and the minted-id map. Pure — `root` is never mutated.
 */
export function applyDocumentEdits(
  root: EditableDocumentNode,
  edits: readonly DocumentEdit[],
): ApplyDocumentEditsResult {
  const mutableRoot = toMutable(root);
  const index = buildIndex(mutableRoot);
  const mintedIds: MintedIds = {};

  edits.forEach((edit, editIndex) => {
    if (edit.op === "insert") {
      const parent = index.byId.get(edit.parentId);
      if (parent === undefined) return;
      const minted: string[] = [];
      const node = nodeInputToMutable(edit.node, minted, index);
      insertChild(parent, node, edit.index);
      registerSubtree(index, node);
      if (Arr.isReadonlyArrayNonEmpty(minted)) {
        mintedIds[String(editIndex)] = minted;
      }
      return;
    }
    if (edit.op === "update") {
      const node = index.byId.get(edit.nodeId);
      if (node === undefined) return;
      node.data = mergeData(node.data, edit.set);
      return;
    }
    if (edit.op === "move") {
      const node = index.byId.get(edit.nodeId);
      const parent = index.byId.get(edit.parentId);
      if (node === undefined || parent === undefined) return;
      const currentParent = index.parentOf.get(node.id);
      if (currentParent === undefined) return;
      detachChild(currentParent, node.id);
      insertChild(parent, node, edit.index);
      index.parentOf.set(node.id, parent);
      return;
    }
    if (edit.op === "remove") {
      const node = index.byId.get(edit.nodeId);
      if (node === undefined) return;
      const parent = index.parentOf.get(node.id);
      if (parent === undefined) return;
      detachChild(parent, node.id);
      unregisterSubtree(index, node);
      return;
    }
    if (edit.op === "replaceChildren") {
      const node = index.byId.get(edit.nodeId);
      if (node === undefined) return;
      Arr.forEach(node.children, (child) => {
        unregisterSubtree(index, child);
      });
      node.children = [];
      const minted: string[] = [];
      Arr.forEach(edit.children, (childInput) => {
        const child = nodeInputToMutable(childInput, minted, index);
        node.children.push(child);
        index.parentOf.set(child.id, node);
        registerSubtree(index, child);
      });
      mintedIds[String(editIndex)] = minted;
    }
  });

  return { root: fromMutable(mutableRoot), mintedIds };
}

// ---------------------------------------------------------------------------
// Tree index (id → node, id → parent) kept in sync as ops mutate the tree
// ---------------------------------------------------------------------------

interface TreeIndex {
  readonly byId: MutableIndex<string, MutableNode>;
  readonly parentOf: MutableIndex<string, MutableNode>;
}

function buildIndex(root: MutableNode): TreeIndex {
  const byId = makeMutableIndex<string, MutableNode>();
  const parentOf = makeMutableIndex<string, MutableNode>();
  const walk = (node: MutableNode, parent: MutableNode | void) => {
    byId.set(node.id, node);
    if (parent !== undefined) parentOf.set(node.id, parent);
    Arr.forEach(node.children, (child) => {
      walk(child, node);
    });
  };
  walk(root, undefined);
  return { byId, parentOf };
}

/** Register a freshly-attached subtree (its parent link is set by the caller). */
function registerSubtree(index: TreeIndex, node: MutableNode): void {
  index.byId.set(node.id, node);
  Arr.forEach(node.children, (child) => {
    index.parentOf.set(child.id, node);
    registerSubtree(index, child);
  });
}

/** Drop a detached subtree from the index (called after `detachChild`). */
function unregisterSubtree(index: TreeIndex, node: MutableNode): void {
  index.byId.delete(node.id);
  index.parentOf.delete(node.id);
  Arr.forEach(node.children, (child) => {
    unregisterSubtree(index, child);
  });
}

/** Insert `node` among `parent`'s children at `index` (clamped into range). */
function insertChild(parent: MutableNode, node: MutableNode, at: number | void): void {
  parent.children.splice(insertPosition(parent.children.length, at), 0, node);
}

/** The resolved insertion position: appended when omitted, else clamped into range. */
function insertPosition(childCount: number, at: number | void): number {
  if (at === undefined) return childCount;
  return clamp(at, childCount);
}

/** Remove the child with `childId` from `parent`'s children (no-op when absent). */
function detachChild(parent: MutableNode, childId: string): void {
  const idx = parent.children.findIndex((child) => child.id === childId);
  if (idx !== -1) parent.children.splice(idx, 1);
}

function clamp(value: number, upper: number): number {
  if (value < 0) return 0;
  return Math.min(value, upper);
}

// ---------------------------------------------------------------------------
// update.set merge (mirrors the mimic Struct update merge)
// ---------------------------------------------------------------------------

/**
 * Merge a `set` partial into a node's `data`. A key whose existing AND incoming
 * value are both plain (non-array, non-null) objects merges per-field
 * recursively (nested structs such as `style`); every other shape (arrays,
 * scalars, or an object replacing a non-object / vice versa) REPLACES the whole
 * value. An `undefined` incoming value deletes the key. Pure — a fresh object is
 * returned, the input `data` is not mutated.
 */
function mergeData(
  data: Record<string, unknown>,
  set: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  Arr.forEach(R.toEntries(set), ([key, value]) => {
    if (value === undefined) {
      delete out[key];
      return;
    }
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = mergeData(existing, value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && P.isObject(value) && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// NodeInput → mutable node (id minting, data nesting)
// ---------------------------------------------------------------------------

/**
 * Convert a {@link NodeInput} (flat `{ type, name?, children?, ...dataFields }`)
 * into a mutable node with a freshly-minted id and its non-structural fields
 * nested under `data`. Recurses into children (minting ids for each, pre-order).
 * Minted ids are appended to `minted` parent-before-children.
 *
 * Ids are minted with a collision guard against the live tree's id index: a
 * fresh {@link shortId} is re-rolled while it already names a node (mirroring
 * mimic's own `nextUniqueNodeId`), so a pre-minted id can never collide with an
 * existing node and make `PaywallDesignerDocument.encode` throw a defect. Each
 * minted id is reserved in the index immediately so siblings minted in the same
 * subtree also stay distinct.
 */
function nodeInputToMutable(node: NodeInput, minted: string[], index: TreeIndex): MutableNode {
  const id = mintUniqueId(index);
  minted.push(id);
  const data: Record<string, unknown> = {};
  Arr.forEach(R.toEntries(node), ([key, value]) => {
    if (key === "type" || key === "children") return;
    data[key] = value;
  });
  const mutable: MutableNode = { id, type: node.type, data, children: [] };
  // Reserve the id before minting children so a sibling can't collide with it.
  index.byId.set(id, mutable);
  mutable.children = (node.children ?? []).map((child) => nodeInputToMutable(child, minted, index));
  return mutable;
}

/**
 * Mint a {@link shortId} that does not already exist in the tree's id index,
 * re-rolling on the (astronomically rare) collision — the same guard mimic's
 * `nextUniqueNodeId` applies so a pre-minted id is always addressable.
 */
function mintUniqueId(index: TreeIndex): string {
  const mint = (): string => {
    const id = shortId();
    return index.byId.has(id) ? mint() : id;
  };
  return mint();
}

// ---------------------------------------------------------------------------
// EditableDocumentNode <-> mutable node
// ---------------------------------------------------------------------------

/** Deep, mutable copy of an input node (its `data` copied top-level; children recursed). */
function toMutable(node: EditableDocumentNode): MutableNode {
  return {
    id: node.id,
    type: node.type,
    data: { ...node.data },
    children: (node.children ?? []).map(toMutable),
  };
}

/** Freeze a mutable node back into the readonly {@link EditableDocumentNode} shape. */
function fromMutable(node: MutableNode): EditableDocumentNode {
  return {
    id: node.id,
    type: node.type,
    data: node.data,
    children: node.children.map(fromMutable),
  };
}
