import { isNodeType, type NodeType } from "@voidhash/mimic-schema";

import { nodeDefaultData, unwrapEntries } from "./mimic-introspection.ts";

/**
 * A decoded mimic snapshot node, as materialized by the designer store /
 * server-side document decode: the CRDT `{id, pos, value}` array envelopes are
 * still present inside `data`, and the node carries its tree position (`pos`,
 * `parentId`) alongside its logical `data`. The serializer accepts this shape and
 * emits the cleaned form the AI model reads.
 *
 * Only the fields the serializer needs are typed; extra fields (`pos`,
 * `parentId`, …) are ignored.
 */
export interface SnapshotDocumentNode {
  readonly id: string;
  readonly type: string;
  readonly data?: Record<string, unknown>;
  readonly children?: readonly SnapshotDocumentNode[];
}

/** A cleaned node in the JSON the model reads (a rendered subtree). */
export interface CleanedDocumentNode {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  /** Remaining non-default data fields (style, text, props, …), envelope-unwrapped. */
  readonly [dataField: string]: unknown;
  readonly children?: readonly (CleanedDocumentNode | CleanedDocumentStub)[];
}

/** A depth-truncated node: identity only, plus how many children were elided. */
export interface CleanedDocumentStub {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  readonly childCount: number;
}

/** Options controlling which subtree, and how deep, {@link serializeDocument} renders. */
export interface SerializeOptions {
  /** Render only the subtree rooted at this node id (defaults to the whole document). */
  readonly nodeId?: string;
  /**
   * Maximum depth to render, counted from the serialization root (`0` = the root
   * node itself as a stub-less node but its children as stubs). Beyond the limit,
   * nodes render as {@link CleanedDocumentStub}s. Omitted = unbounded.
   */
  readonly depth?: number;
}

/**
 * Serialize a decoded mimic document into the cleaned JSON the AI model reads.
 *
 * The cleaned shape drops CRDT internals (`pos`, `parentId`), unwraps
 * `{id, pos, value}` array envelopes recursively, and strips every data field
 * whose value equals that node type's schema default (so the model sees only what
 * was actually authored). It keeps `id` (the model addresses nodes by id in
 * `edit_document`), `type`, `name`, and the remaining data.
 *
 * A `codeComponent` node is emitted WITHOUT its `source` (the full TSX would blow
 * up a whole-document read): only its `path` and a `sourceLength` stub ship — the
 * source is read on demand with `read_component`.
 *
 * `nodeId` selects a subtree root; `depth` caps how deep the tree renders, with
 * deeper nodes collapsed to stubs carrying their `childCount`.
 *
 * @param nodes - The decoded document roots (typically a single `root` node, but
 *   an array is accepted so a forest / a pre-located subtree can be passed).
 * @returns The cleaned subtree root, or `null` when `nodeId` matches no node.
 */
export function serializeDocument(
  nodes: readonly SnapshotDocumentNode[],
  options: SerializeOptions = {},
): CleanedDocumentNode | CleanedDocumentStub | null {
  const root = options.nodeId ? findNode(nodes, options.nodeId) : (nodes[0] ?? null);
  if (!root) return null;
  return cleanNode(root, 0, options.depth);
}

/** Depth-first search for a node by id across a decoded forest. */
function findNode(
  nodes: readonly SnapshotDocumentNode[],
  id: string,
): SnapshotDocumentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

/** Structural equality on two already-unwrapped values (order-sensitive for arrays). */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Strip default-equal leaves from an already-unwrapped value, guided by its
 * unwrapped default. For a plain object, each key equal to its default is
 * dropped and each remaining object recurses; a whole object that reduces to
 * empty is dropped by the caller. Arrays and scalars are compared whole (an
 * array equal to its default is dropped; otherwise kept verbatim — the model
 * needs the full list to reason about it).
 */
function stripDefaults(value: unknown, defaultValue: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    defaultValue !== null &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue)
  ) {
    const defObj = defaultValue as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, sub] of Object.entries(value as Record<string, unknown>)) {
      if (key in defObj && deepEqual(sub, defObj[key])) continue;
      const stripped = key in defObj ? stripDefaults(sub, defObj[key]) : sub;
      if (isEmptyStructural(stripped)) continue;
      out[key] = stripped;
    }
    return out;
  }
  return value;
}

function cleanNode(
  node: SnapshotDocumentNode,
  currentDepth: number,
  maxDepth: number | undefined,
): CleanedDocumentNode | CleanedDocumentStub {
  const children = node.children ?? [];

  if (maxDepth !== undefined && currentDepth > maxDepth) {
    return stubNode(node, children.length);
  }

  const cleaned: Record<string, unknown> = { id: node.id, type: node.type };
  const data = node.data ?? {};
  const defaults = isNodeType(node.type) ? nodeDefaultData(node.type as NodeType) : {};

  const name = data["name"];
  if (typeof name === "string") cleaned["name"] = name;

  // A `codeComponent` node's `source` is the full TSX — never inline it (a whole
  // document read would dump every component's source, a token blowout). Emit its
  // `path` (the identity the model addresses) plus a length stub; the deliberate
  // source read is `read_component`.
  if (node.type === "codeComponent") {
    const path = unwrapEntries(data["path"]);
    if (typeof path === "string") cleaned["path"] = path;
    const source = unwrapEntries(data["source"]);
    cleaned["sourceLength"] = typeof source === "string" ? source.length : 0;
    if (children.length > 0) {
      cleaned["children"] = children.map((child) => cleanNode(child, currentDepth + 1, maxDepth));
    }
    return cleaned as unknown as CleanedDocumentNode;
  }

  for (const [key, rawValue] of Object.entries(data)) {
    if (key === "name") continue;
    const value = unwrapEntries(rawValue);
    // Drop fields equal to their schema default; recurse into nested objects
    // (e.g. `style`) so a single deviation doesn't drag every default sibling
    // along. The model then sees only what was actually authored.
    if (key in defaults && deepEqual(value, defaults[key])) continue;
    const stripped = key in defaults ? stripDefaults(value, defaults[key]) : value;
    if (isEmptyStructural(stripped)) continue;
    cleaned[key] = stripped;
  }

  if (children.length > 0) {
    cleaned["children"] = children.map((child) => cleanNode(child, currentDepth + 1, maxDepth));
  }

  return cleaned as unknown as CleanedDocumentNode;
}

/** A depth-truncated stub: identity + name + child count only. */
function stubNode(node: SnapshotDocumentNode, childCount: number): CleanedDocumentStub {
  const name = node.data?.["name"];
  const stub: CleanedDocumentStub = { id: node.id, type: node.type, childCount };
  return typeof name === "string" ? { ...stub, name } : stub;
}

/** Whether a value is an empty array or empty object (nothing authored to show). */
function isEmptyStructural(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value !== null && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
