/**
 * Pure snapshot readers over the decoded paywall document (the array of root
 * snapshots produced by `PaywallDesignerDocument.decode`). Reimplemented here —
 * rather than importing the store-coupled designer selectors — so the workspace
 * projection stays free of any Zustand/React dependency and runs unchanged in a
 * Worker or Node.
 */

/**
 * The minimal structural shape of a decoded document node these readers need:
 * `{id, type, data, children}`. Deliberately structural (rather than the
 * renderer's `SnapshotNode` union) so BOTH the renderer snapshot types and the
 * raw `PaywallDesignerDocument.decode` output are accepted without narrowing.
 */
export interface DocumentSnapshotNode {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly children: readonly DocumentSnapshotNode[];
}

/**
 * A code-component definition read from a document snapshot. `path` is the
 * component's IDENTITY — the canonical document-relative path
 * `components/<basename>.tsx` stored on the `codeComponent` node. `id` is the
 * CRDT node id (still needed to target designer actions at a specific node).
 */
export interface WorkspaceComponentDefinition {
  readonly id: string;
  readonly path: string;
  readonly source: string;
}

/**
 * The `codeComponent` definition nodes of a document, read from the singleton
 * `library` node under the (single) document root. Returns an empty list when
 * the document has no root or no library yet.
 */
export function readComponentDefinitions(
  snapshot: readonly DocumentSnapshotNode[],
): WorkspaceComponentDefinition[] {
  const root = snapshot[0];
  if (root === undefined) {
    return [];
  }
  const library = root.children.find((child) => child.type === "library");
  if (library === undefined) {
    return [];
  }
  return library.children.flatMap(toDefinition);
}

/** The definition carried by a `codeComponent` node, or nothing for other node types. */
function toDefinition(node: DocumentSnapshotNode): WorkspaceComponentDefinition[] {
  if (node.type !== "codeComponent") {
    return [];
  }
  return [
    {
      id: node.id,
      path: stringField(node.data, "path"),
      source: stringField(node.data, "source"),
    },
  ];
}

/** Reads a string field off a node's decoded data, or `""` when absent/non-string. */
function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}
