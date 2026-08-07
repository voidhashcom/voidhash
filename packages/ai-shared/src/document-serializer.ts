import { isNodeType } from "@voidhash/mimic-schema";

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
 * `edit_paywall`), `type`, `name`, and the remaining data.
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
  const root = locateRoot(nodes, options.nodeId);
  if (!root) return null;
  return cleanNode(root, 0, options.depth);
}

/** The serialization root: the named subtree when `nodeId` is given, else the first node. */
function locateRoot(
  nodes: readonly SnapshotDocumentNode[],
  nodeId: string | undefined,
): SnapshotDocumentNode | null {
  if (!nodeId) return nodes[0] ?? null;
  return findNode(nodes, nodeId);
}

/** The mutable builder shape a {@link CleanedDocumentNode} is assembled into, key by key. */
interface CleanedNodeDraft {
  id: string;
  type: string;
  name?: string;
  children?: readonly (CleanedDocumentNode | CleanedDocumentStub)[];
  [dataField: string]: unknown;
}

/** A non-null, non-array object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Depth-first search for a node by id across a decoded forest. */
function findNode(nodes: readonly SnapshotDocumentNode[], id: string): SnapshotDocumentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

/** Structural equality on two already-unwrapped values (order-sensitive for arrays). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => key in b && deepEqual(a[key], b[key]));
  }
  return false;
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
  if (!isPlainRecord(value) || !isPlainRecord(defaultValue)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, sub] of Object.entries(value)) {
    if (key in defaultValue && deepEqual(sub, defaultValue[key])) continue;
    const stripped = strippedAgainstDefault(sub, defaultValue, key);
    if (isEmptyStructural(stripped)) continue;
    out[key] = stripped;
  }
  return out;
}

/** {@link stripDefaults} against `defaults[key]`, or the value verbatim when it has no default. */
function strippedAgainstDefault(
  value: unknown,
  defaults: Record<string, unknown>,
  key: string,
): unknown {
  if (!(key in defaults)) return value;
  return stripDefaults(value, defaults[key]);
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

  const cleaned: CleanedNodeDraft = { id: node.id, type: node.type };
  const data = node.data ?? {};
  const defaults = defaultDataOf(node.type);

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
    cleaned["sourceLength"] = stringLength(source);
    if (children.length > 0) {
      cleaned["children"] = children.map((child) => cleanNode(child, currentDepth + 1, maxDepth));
    }
    return cleaned;
  }

  for (const [key, rawValue] of Object.entries(data)) {
    if (key === "name") continue;
    const value = unwrapEntries(rawValue);
    // Drop fields equal to their schema default; recurse into nested objects
    // (e.g. `style`) so a single deviation doesn't drag every default sibling
    // along. The model then sees only what was actually authored.
    if (key in defaults && deepEqual(value, defaults[key])) continue;
    const stripped = strippedAgainstDefault(value, defaults, key);
    if (isEmptyStructural(stripped)) continue;
    cleaned[key] = stripped;
  }

  if (children.length > 0) {
    cleaned["children"] = children.map((child) => cleanNode(child, currentDepth + 1, maxDepth));
  }

  return cleaned;
}

/** The defaults-filled data snapshot for a node type, or `{}` for a non-mimic type. */
function defaultDataOf(type: string): Record<string, unknown> {
  if (!isNodeType(type)) return {};
  return nodeDefaultData(type);
}

/** The length of a value that is a string, else `0`. */
function stringLength(value: unknown): number {
  if (typeof value === "string") return value.length;
  return 0;
}

/** A depth-truncated stub: identity + name + child count only. */
function stubNode(node: SnapshotDocumentNode, childCount: number): CleanedDocumentStub {
  const name = node.data?.["name"];
  const stub: CleanedDocumentStub = { id: node.id, type: node.type, childCount };
  if (typeof name === "string") return { ...stub, name };
  return stub;
}

/** Whether a value is an empty array or empty object (nothing authored to show). */
function isEmptyStructural(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value !== null && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
