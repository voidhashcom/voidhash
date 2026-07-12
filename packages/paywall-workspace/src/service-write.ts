import type { TreeValue } from "@voidhash/mimic-core";
import { PaywallDesignerDocument, reconcile } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  applyDocumentEdits,
  unwrapEntries,
  type DocumentEdit,
  type EditableDocumentNode,
  type MintedIds,
} from "@voidhash/ai-shared";

export type { DocumentEdit, MintedIds } from "@voidhash/ai-shared";

import { fileNameFromDocRelative } from "./paths.ts";
import { readComponentDefinitions } from "./snapshot.ts";
import {
  lowerComponentDelete,
  lowerComponentMove,
  validateComponentFileName,
  type ApplyFileWriteResult,
} from "./write.ts";

/**
 * Narrow a raw mimic document value (the encoded `TreeValue` returned by the
 * mimic host as `unknown`) into a `TreeValue`, or `undefined` when it is not a
 * well-formed tree. Structural — the pure package owns the narrowing (core stays
 * free of the mimic-core value kinds).
 */
function asTreeValue(tree: unknown): TreeValue | undefined {
  return tree !== null &&
    typeof tree === "object" &&
    (tree as { kind?: unknown }).kind === "tree" &&
    Array.isArray((tree as { nodes?: unknown }).nodes)
    ? (tree as TreeValue)
    : undefined;
}

/**
 * Encode a decoded paywall document (array of root snapshots) into the RAW
 * `TreeValue` that the mimic host stores and the write path reconciles against.
 * The inverse of `PaywallDesignerDocument.decode`. Exposed from the pure package
 * so consumers (and tests) can build a raw document tree without importing
 * `mimic-schema` directly — mirroring how {@link componentPathsFromTree} owns the
 * decode.
 */
export function encodePaywallDocument(roots: unknown): unknown {
  return PaywallDesignerDocument.encode(roots as never);
}

/**
 * Result of a server-side workspace lowering ({@link applyWorkspaceMove},
 * {@link applyWorkspaceDelete}, {@link reconcileToTree}): either the lowered
 * command batch, or a rejection — including the case where the raw tree was not a
 * well-formed tree value.
 */
export type ApplyWorkspaceWriteResult =
  | ApplyFileWriteResult
  | {
      readonly kind: "rejected";
      readonly diagnostics: ReadonlyArray<{ readonly message: string }>;
    };

/**
 * Server-side orchestration of a component MOVE (a file rename): narrow the raw
 * document tree and lower the move ({@link lowerComponentMove} — repaths the
 * target `codeComponent` node's `path` and re-points every local instance
 * referencing it). No registry needed (a move never touches the composition
 * grammar directly, only node paths). A malformed tree is rejected on the typed
 * channel. `fromPath`/`toPath` are canonical document-relative component paths
 * (`components/<basename>.tsx`).
 */
export function applyWorkspaceMove(input: {
  readonly fromPath: string;
  readonly toPath: string;
  readonly tree: unknown;
}): ApplyWorkspaceWriteResult {
  const liveTree = asTreeValue(input.tree);
  if (liveTree === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "The paywall document is not a well-formed tree." }],
    };
  }
  return lowerComponentMove(liveTree, input.fromPath, input.toPath);
}

/**
 * Server-side orchestration of a component DELETE: narrow the raw document tree
 * and lower the delete ({@link lowerComponentDelete} — removes only the target
 * `codeComponent` node, never cascading into `component` instances). No registry
 * needed. A malformed tree is rejected on the typed channel. `path` is the
 * component's canonical document-relative identity.
 */
export function applyWorkspaceDelete(input: {
  readonly path: string;
  readonly tree: unknown;
}): ApplyWorkspaceWriteResult {
  const liveTree = asTreeValue(input.tree);
  if (liveTree === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "The paywall document is not a well-formed tree." }],
    };
  }
  return lowerComponentDelete(liveTree, input.path);
}

/**
 * The canonical document-relative `path`s of a document's code-component
 * definitions read from its RAW encoded tree — the existing paths a server-side
 * component create needs to derive a unique file name
 * ({@link uniqueComponentFileName}) the same way the browser does, and the keys a
 * move must check for collisions.
 */
export function componentPathsFromTree(tree: unknown): string[] {
  const value = asTreeValue(tree);
  if (value === undefined) {
    return [];
  }
  const snapshot = (PaywallDesignerDocument.decode(value) ?? []) as readonly SnapshotNode[];
  return readComponentDefinitions(snapshot).map((definition) => definition.path);
}

/**
 * Reconcile the CURRENT document tree back to a previously captured `target`
 * tree — the checkpoint-revert lowering. Returns the minimal command batch that
 * transforms the live document into the captured pre-turn state (empty when they
 * already match). A malformed live or captured tree is rejected on the typed
 * channel. Pure — the retry/submit loop lives in the workspace service.
 */
export function reconcileToTree(input: {
  readonly current: unknown;
  readonly target: unknown;
}): ApplyWorkspaceWriteResult {
  const current = asTreeValue(input.current);
  const target = asTreeValue(input.target);
  if (current === undefined || target === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "A revert tree is not a well-formed document tree." }],
    };
  }
  return { kind: "commands", commands: reconcile(current, target) };
}

/**
 * The outcome of {@link applyDocumentEditsToTree}: the reconcile lowering to
 * submit, plus the ids minted for every node an `insert` / `replaceChildren` op
 * created (so the caller can return them to the model).
 */
export interface ApplyDocumentEditsToTreeResult {
  readonly result: ApplyWorkspaceWriteResult;
  readonly mintedIds: MintedIds;
}

/**
 * Adapt a decoded document snapshot node to the ai-shared
 * {@link EditableDocumentNode} the applier + encoder read: keep `id`/`type`, and
 * UNWRAP the CRDT `{id,pos,value}` array envelopes inside `data` so the encoder
 * (which re-mints array-item envelopes) accepts it — a proven no-op round-trip
 * through `reconcile`, which ignores array-item envelopes.
 */
function snapshotToEditable(node: SnapshotNode): EditableDocumentNode {
  return {
    id: node.id,
    type: node.type,
    data: unwrapEntries(node.data) as Record<string, unknown>,
    children: node.children.map(snapshotToEditable),
  };
}

/** Flatten an {@link EditableDocumentNode} into the `PaywallDesignerDocument.encode` input shape. */
function editableToEncodeInput(node: EditableDocumentNode): Record<string, unknown> {
  const input: Record<string, unknown> = { id: node.id, type: node.type };
  for (const [key, value] of Object.entries(node.data ?? {})) {
    input[key] = value;
  }
  input["children"] = (node.children ?? []).map(editableToEncodeInput);
  return input;
}

/**
 * Apply a batch of ALREADY-VALIDATED {@link DocumentEdit} ops to the live raw
 * document `tree` and reconcile the result into a command batch — the server
 * lowering behind the AI/MCP `edit_paywall` tool. Decodes the raw tree to the
 * editable snapshot, runs the pure {@link applyDocumentEdits} applier (which
 * pre-mints real {@link import("@voidhash/mimic-core").shortId} ids for
 * created nodes), re-encodes the target, and `reconcile`s the live tree to it.
 *
 * The minted ids SURVIVE: `PaywallDesignerDocument.encode` preserves any `id`
 * present on an input node, and `reconcile` emits `tree.insert` carrying the
 * target id verbatim for a node id absent from the live tree — so a follow-up
 * edit can address the newly-created nodes by the returned ids.
 *
 * Designed to be re-run per submit attempt against a FRESH `tree`: the ops are
 * id/position-based, so re-deriving the target from an advanced live tree merges
 * concurrent edits rather than clobbering them. A malformed tree is rejected on
 * the typed channel.
 */
export function applyDocumentEditsToTree(input: {
  readonly tree: unknown;
  readonly edits: readonly DocumentEdit[];
}): ApplyDocumentEditsToTreeResult {
  const current = asTreeValue(input.tree);
  if (current === undefined) {
    return {
      result: {
        kind: "rejected",
        diagnostics: [{ message: "The paywall document is not a well-formed tree." }],
      },
      mintedIds: {},
    };
  }
  const snapshot = (PaywallDesignerDocument.decode(current) ?? []) as readonly SnapshotNode[];
  const root = snapshot[0];
  if (root === undefined) {
    return {
      result: {
        kind: "rejected",
        diagnostics: [{ message: "The paywall document has no root node to edit." }],
      },
      mintedIds: {},
    };
  }
  const { root: target, mintedIds } = applyDocumentEdits(snapshotToEditable(root), input.edits);
  const encoded = PaywallDesignerDocument.encode([editableToEncodeInput(target)] as never);
  const targetTree = asTreeValue(encoded);
  if (targetTree === undefined) {
    return {
      result: {
        kind: "rejected",
        diagnostics: [{ message: "The edited document failed to re-encode into a tree." }],
      },
      mintedIds: {},
    };
  }
  return {
    result: { kind: "commands", commands: reconcile(current, targetTree) },
    mintedIds,
  };
}

/**
 * Lower a component-source WRITE to a reconcile command batch: create-or-replace
 * a `codeComponent` definition at the canonical document-relative `path`
 * (`components/<basename>.tsx`), mirroring the browser's create/write semantics.
 *
 * - An existing `codeComponent` at `path` has its `source` replaced.
 * - A new `path` is created: the singleton `library` node under the root is
 *   found (created on first use), and a fresh `codeComponent` with `{path,
 *   source}` is appended — the engine mints its id (which the write does not
 *   need to return; a follow-up read addresses it by path).
 *
 * A malformed tree (or one with no root) is rejected on the typed channel, as is
 * an invalid component file name. Pure — decodes, edits the snapshot, re-encodes,
 * and reconciles against the live tree; re-runnable per submit attempt.
 */
export function writeComponentSourceToTree(input: {
  readonly tree: unknown;
  readonly path: string;
  readonly source: string;
}): ApplyWorkspaceWriteResult {
  const nameError = validateComponentFileName(fileNameFromDocRelative(input.path));
  if (nameError !== undefined) {
    return { kind: "rejected", diagnostics: [{ message: nameError }] };
  }
  const current = asTreeValue(input.tree);
  if (current === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "The paywall document is not a well-formed tree." }],
    };
  }
  const snapshot = (PaywallDesignerDocument.decode(current) ?? []) as readonly SnapshotNode[];
  const root = snapshot[0];
  if (root === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "The paywall document has no root node to write into." }],
    };
  }

  const rootInput = editableToEncodeInput(snapshotToEditable(root));
  const children = rootInput["children"] as Record<string, unknown>[];

  let library = children.find((child) => child["type"] === "library");
  if (library === undefined) {
    library = { type: "library", children: [] as Record<string, unknown>[] };
    children.push(library);
  }
  const libraryChildren = (library["children"] ??= []) as Record<string, unknown>[];

  const existing = libraryChildren.find(
    (child) => child["type"] === "codeComponent" && child["path"] === input.path,
  );
  if (existing !== undefined) {
    existing["source"] = input.source;
  } else {
    libraryChildren.push({ type: "codeComponent", path: input.path, source: input.source });
  }

  const encoded = PaywallDesignerDocument.encode([rootInput] as never);
  const targetTree = asTreeValue(encoded);
  if (targetTree === undefined) {
    return {
      kind: "rejected",
      diagnostics: [{ message: "The edited document failed to re-encode into a tree." }],
    };
  }
  return { kind: "commands", commands: reconcile(current, targetTree) };
}
