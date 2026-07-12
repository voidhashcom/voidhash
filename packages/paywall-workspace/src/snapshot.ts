import type {
  CodeComponentSnapshotNode,
  SnapshotNode,
} from "@voidhash/paywall-renderer-web-core";

/**
 * Pure snapshot readers over the decoded paywall document (the array of root
 * snapshots produced by `PaywallDesignerDocument.decode`). Reimplemented here —
 * rather than importing the store-coupled designer selectors — so the workspace
 * projection stays free of any Zustand/React dependency and runs unchanged in a
 * Worker or Node.
 */

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
  snapshot: readonly SnapshotNode[],
): WorkspaceComponentDefinition[] {
  const root = snapshot[0];
  if (root === undefined) {
    return [];
  }
  const library = root.children.find((child) => child.type === "library");
  if (library === undefined) {
    return [];
  }
  return library.children.flatMap((node) =>
    node.type === "codeComponent" ? [toDefinition(node)] : [],
  );
}

function toDefinition(node: CodeComponentSnapshotNode): WorkspaceComponentDefinition {
  return { id: node.id, path: node.data.path, source: node.data.source };
}
