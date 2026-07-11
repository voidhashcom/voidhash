/**
 * The document-JSON edit action behind the AI `edit_document` tool.
 *
 * A single generic undoable action that applies a validated batch of
 * {@link DocumentEdit} ops (insert / update / move / remove / replaceChildren)
 * to the open paywall through ONE mimic transaction, with ONE undo entry for the
 * whole batch. The AI edit vocabulary and its schema-derived validator live in
 * `@voidhash/ai-shared`; this action is the browser-side apply that runs the
 * ops against the designer store's mimic document and captures a per-op inverse
 * so the batch is atomically undoable.
 */

import {
  validateDocumentEdits,
  type DocumentEdit,
  type DocumentEditErrorResult,
  type EditableDocumentNode,
  type MintedIds,
  type NodeInput,
} from "@voidhash/ai-shared";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import type { DesignerDocumentRoot } from "../utils/node-proxies";
import { unwrapEntriesDeep } from "../utils/replay";

// =============================================================================
// Public result
// =============================================================================

/**
 * The outcome of an {@link applyDocumentEdits} dispatch, matching ai-shared's
 * `EditDocumentResult`: on success the minted-id map (insert/replaceChildren op
 * index → the ids the engine minted, root-first), on failure the collected
 * per-edit validation errors (nothing was applied — no transaction opened, no
 * undo entry pushed).
 */
export type ApplyDocumentEditsResult =
  | { readonly ok: true; readonly mintedIds: MintedIds }
  | { readonly ok: false; readonly errors: readonly DocumentEditErrorResult[] };

// =============================================================================
// Snapshot → EditableDocumentNode adapter
// =============================================================================

/**
 * Adapts a decoded designer snapshot subtree to the validator's minimal
 * {@link EditableDocumentNode} shape. `data` is passed through verbatim: the
 * validator only reads the scalar/enum leaves it addresses (envelope unwrapping
 * is not required — see the ai-shared validator docs).
 */
function toEditableNode(node: SnapshotNode): EditableDocumentNode {
  return {
    id: node.id,
    type: node.type,
    data: node.data as Record<string, unknown>,
    children: node.children.map(toEditableNode),
  };
}

// =============================================================================
// Insert (NodeInput → minted ids)
// =============================================================================

/**
 * Inserts a {@link NodeInput} subtree under `parentId` at `index`, recursing
 * into children. Every node's id is engine-minted; the minted ids are collected
 * pre-order (parent before children) into `minted`. Returns the root minted id
 * (or `null` when the insert is rejected — e.g. an illegal parent/child combo the
 * transaction throws on).
 */
function insertNodeInput(
  root: DesignerDocumentRoot,
  parentId: string,
  node: NodeInput,
  index: number | undefined,
  minted: string[],
): string | null {
  const parent = root.findByIdAcrossTree(parentId);
  if (parent === undefined) {
    return null;
  }
  const input = nodeInputToData(node) as Parameters<typeof parent.children.insertLast>[0];
  const inserted =
    index === undefined
      ? parent.children.insertLast(input)
      : parent.children.insertAt(index, input);
  minted.push(inserted.id);
  for (const child of node.children ?? []) {
    insertNodeInput(root, inserted.id, child, undefined, minted);
  }
  return inserted.id;
}

/**
 * Flattens a {@link NodeInput} to the `{ type, name?, ...data }` write input the
 * mimic `children.insert*` primitive accepts — `children` is stripped (inserted
 * recursively) and every other field (style, text, component identity, …) is
 * spread at the top level.
 */
function nodeInputToData(node: NodeInput): Record<string, unknown> {
  const input: Record<string, unknown> = { type: node.type };
  for (const [key, value] of Object.entries(node)) {
    if (key === "type" || key === "children") continue;
    input[key] = value;
  }
  return input;
}

// =============================================================================
// Serialize (for remove / replaceChildren undo)
// =============================================================================

interface SerializedSubtree {
  type: string;
  data: Record<string, unknown>;
  children: SerializedSubtree[];
}

/**
 * Serializes a snapshot subtree into plain write-input shape (CRDT `{id,pos,value}`
 * array envelopes unwrapped) so undo can replay it through the insert primitive.
 * Node ids are intentionally dropped — the engine re-mints them on restore.
 */
function serializeSubtree(node: SnapshotNode): SerializedSubtree {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.data)) {
    data[key] = unwrapEntriesDeep(value);
  }
  return {
    type: node.type,
    data,
    children: node.children.map(serializeSubtree),
  };
}

/** Re-inserts a serialized subtree under `parentId` at `index` (undo of remove). */
function restoreSubtree(
  root: DesignerDocumentRoot,
  parentId: string,
  subtree: SerializedSubtree,
  index: number | undefined,
): void {
  const parent = root.findByIdAcrossTree(parentId);
  if (parent === undefined) {
    return;
  }
  try {
    const input = { ...subtree.data, type: subtree.type } as Parameters<
      typeof parent.children.insertLast
    >[0];
    const node =
      index === undefined
        ? parent.children.insertLast(input)
        : parent.children.insertAt(index, input);
    for (const child of subtree.children) {
      restoreSubtree(root, node.id, child, undefined);
    }
  } catch {
    // Illegal parent/child combination on restore — drop the subtree rather than
    // throw out of the undo transaction.
  }
}

// =============================================================================
// Per-op inverse capture
// =============================================================================

/** The captured inverse of one applied op, replayed (in reverse) on undo. */
type OpInverse =
  | { kind: "remove-minted"; ids: string[] }
  | { kind: "restore-data"; nodeId: string; previous: Record<string, unknown> }
  | { kind: "move-back"; nodeId: string; parentId: string; index: number }
  | { kind: "restore-subtree"; parentId: string; subtree: SerializedSubtree; index: number }
  | {
      kind: "restore-children";
      nodeId: string;
      previous: SerializedSubtree[];
      mintedIds: string[];
    };

/**
 * Captures the RESTORE PATCH that `node.update(...)` replays on undo to return
 * every top-level `data` key an `update.set` touched to its exact prior value.
 *
 * `node.update` merges per-key (mimic `emitStructUpdate` never deletes a key the
 * patch omits), so a naive "replay the previous object" leaves behind any sub-key
 * the forward edit ADDED (e.g. `style.shadowRadius` on a style that lacked it).
 * The patch therefore pairs the envelope-unwrapped previous value with explicit
 * `undefined` markers for every key the incoming `set` value added but the
 * previous value did not have — recursively for nested objects — so the merge
 * DELETES the additions and the field ends up exactly as it was. A key absent
 * from the current data maps to `undefined` (a whole-field delete).
 */
function capturePreviousData(
  current: SnapshotNode | undefined,
  set: Record<string, unknown>,
): Record<string, unknown> {
  const previous: Record<string, unknown> = {};
  const data = (current?.data ?? {}) as Record<string, unknown>;
  for (const [key, incoming] of Object.entries(set)) {
    if (!(key in data)) {
      // The field did not exist → undo deletes it wholesale.
      previous[key] = undefined;
      continue;
    }
    previous[key] = restorePatchFor(unwrapEntriesDeep(data[key]), incoming);
  }
  return previous;
}

/**
 * The value `node.update` must merge to restore `prev` after a forward merge of
 * `incoming` overwrote it. For two plain objects it returns `prev`'s keys PLUS an
 * `undefined` for each key `incoming` introduced that `prev` lacked (recursing
 * into shared object keys), so the merge deletes the additions. For every other
 * shape (arrays, scalars, an object replacing a non-object) `prev` replaces
 * wholesale, so it is returned verbatim.
 */
function restorePatchFor(prev: unknown, incoming: unknown): unknown {
  if (!isPlainObject(prev) || !isPlainObject(incoming)) {
    return prev;
  }
  const patch: Record<string, unknown> = {};
  for (const [key, prevValue] of Object.entries(prev)) {
    patch[key] = key in incoming ? restorePatchFor(prevValue, incoming[key]) : prevValue;
  }
  // Keys the forward edit ADDED (present in `incoming`, absent from `prev`) must
  // be deleted on undo — merge an explicit `undefined`.
  for (const key of Object.keys(incoming)) {
    if (!(key in prev)) {
      patch[key] = undefined;
    }
  }
  return patch;
}

/** Whether a value is a plain (non-array, non-null) object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The current sibling index of `nodeId` under `parentNode`, or 0 when absent. */
function indexInParent(parentNode: SnapshotNode | undefined, nodeId: string): number {
  if (parentNode === undefined) return 0;
  const idx = parentNode.children.findIndex((child) => child.id === nodeId);
  return idx === -1 ? 0 : idx;
}

// =============================================================================
// Action
// =============================================================================

/**
 * Applies a validated batch of document edits to the open paywall in one
 * transaction, capturing a per-op inverse for a single atomic undo entry.
 *
 * The batch is first re-validated against the committed tree via
 * {@link validateDocumentEdits} (the same schema-derived validator the AI tool
 * ran); on failure NO transaction opens and NO undo entry is pushed — the action
 * returns the structured errors so the model can converge. On success every op is
 * applied in order and its inverse recorded:
 *
 * - `insert` / `replaceChildren` — remove the minted root ids (restore the prior
 *   children for `replaceChildren`).
 * - `update` — a restore patch reconstructing each touched `set` key's prior
 *   value (`undefined` = the field was absent → restored as a delete). Because
 *   `node.update`'s merge never deletes an omitted key, the patch pairs the prior
 *   value with explicit `undefined` markers for sub-keys the edit ADDED (e.g.
 *   `style.shadowRadius` on a style that lacked it), so undo removes them and the
 *   object returns EXACTLY to its prior shape. `set` itself is applied verbatim
 *   through `node.update` (objects like `style` merge per field; arrays/scalars
 *   replace wholesale — the tool's contract).
 * - `move` — the previous parent + sibling index (moved back preserving the id).
 * - `remove` — the serialized subtree + its position (re-inserted on undo).
 *
 * @returns `{ ok: true, mintedIds }` mapping each insert/replaceChildren op index
 *   to its minted ids, or `{ ok: false, errors }` when the batch is invalid.
 */
export const applyDocumentEdits = commander.undoableAction<
  { edits: readonly DocumentEdit[] },
  { inverses: OpInverse[]; result: ApplyDocumentEditsResult }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    const validation = validateDocumentEdits(params.edits, toEditableNode(selectDocumentRoot(state)));
    if (!validation.ok) {
      // Bail before opening a transaction so no undo entry is recorded.
      return { inverses: [], result: { ok: false, errors: validation.errors } };
    }

    const inverses: OpInverse[] = [];
    const mintedIds: MintedIds = {};

    mimic.document.transaction((root) => {
      validation.edits.forEach((edit, editIndex) => {
        switch (edit.op) {
          case "insert": {
            const minted: string[] = [];
            insertNodeInput(root, edit.parentId, edit.node, edit.index, minted);
            if (minted.length > 0) {
              mintedIds[String(editIndex)] = minted;
              inverses.push({ kind: "remove-minted", ids: [minted[0] as string] });
            }
            break;
          }
          case "update": {
            const current = root.findByIdAcrossTree(edit.nodeId)?.get() as SnapshotNode | undefined;
            const previous = capturePreviousData(current, edit.set);
            const node = root.findByIdAcrossTree(edit.nodeId);
            if (node !== undefined) {
              node.update(edit.set);
              inverses.push({ kind: "restore-data", nodeId: edit.nodeId, previous });
            }
            break;
          }
          case "move": {
            const node = root.findByIdAcrossTree(edit.nodeId);
            const parent = root.findByIdAcrossTree(edit.parentId);
            if (node === undefined || parent === undefined) break;
            const snapshot = node.get() as SnapshotNode | undefined;
            const previousParentId = snapshot?.parentId;
            if (typeof previousParentId === "string") {
              const previousParent = root.findByIdAcrossTree(previousParentId)?.get() as
                | SnapshotNode
                | undefined;
              inverses.push({
                kind: "move-back",
                nodeId: edit.nodeId,
                parentId: previousParentId,
                index: indexInParent(previousParent, edit.nodeId),
              });
            }
            node.moveTo(parent.children, edit.index);
            break;
          }
          case "remove": {
            const node = root.findByIdAcrossTree(edit.nodeId);
            const snapshot = node?.get() as SnapshotNode | undefined;
            if (node === undefined || snapshot === undefined) break;
            const parentId = snapshot.parentId;
            if (typeof parentId === "string") {
              const parent = root.findByIdAcrossTree(parentId)?.get() as SnapshotNode | undefined;
              inverses.push({
                kind: "restore-subtree",
                parentId,
                subtree: serializeSubtree(snapshot),
                index: indexInParent(parent, edit.nodeId),
              });
            }
            node.remove();
            break;
          }
          case "replaceChildren": {
            const node = root.findByIdAcrossTree(edit.nodeId);
            const snapshot = node?.get() as SnapshotNode | undefined;
            if (node === undefined || snapshot === undefined) break;
            const previous = snapshot.children.map(serializeSubtree);
            for (const child of [...snapshot.children]) {
              root.findByIdAcrossTree(child.id)?.remove();
            }
            const minted: string[] = [];
            for (const child of edit.children) {
              insertNodeInput(root, edit.nodeId, child, undefined, minted);
            }
            mintedIds[String(editIndex)] = minted;
            inverses.push({ kind: "restore-children", nodeId: edit.nodeId, previous, mintedIds: minted });
            break;
          }
        }
      });
    });

    return { inverses, result: { ok: true, mintedIds } };
  },
  (ctx, _params, result) => {
    if (result.inverses.length === 0) {
      return;
    }
    const { mimic } = ctx.getState();

    // Replay inverses in reverse application order so indices/positions line up.
    mimic.document.transaction((root) => {
      for (let i = result.inverses.length - 1; i >= 0; i--) {
        const inverse = result.inverses[i];
        if (inverse === undefined) continue;
        switch (inverse.kind) {
          case "remove-minted": {
            for (const id of inverse.ids) {
              root.findByIdAcrossTree(id)?.remove();
            }
            break;
          }
          case "restore-data": {
            root.findByIdAcrossTree(inverse.nodeId)?.update(inverse.previous);
            break;
          }
          case "move-back": {
            const node = root.findByIdAcrossTree(inverse.nodeId);
            const parent = root.findByIdAcrossTree(inverse.parentId);
            if (node !== undefined && parent !== undefined) {
              node.moveTo(parent.children, inverse.index);
            }
            break;
          }
          case "restore-subtree": {
            restoreSubtree(root, inverse.parentId, inverse.subtree, inverse.index);
            break;
          }
          case "restore-children": {
            // Remove the replacement children, then restore the originals in order.
            for (const id of inverse.mintedIds) {
              root.findByIdAcrossTree(id)?.remove();
            }
            inverse.previous.forEach((subtree, index) => {
              restoreSubtree(root, inverse.nodeId, subtree, index);
            });
            break;
          }
        }
      }
    });
  },
);
