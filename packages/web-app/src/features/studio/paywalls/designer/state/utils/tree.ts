/**
 * Snapshot-tree walk helpers for the nested `{id, type, parentId, pos, data,
 * children}` node shape. Generic over any structurally compatible node so the
 * same helpers serve web-core `SnapshotNode` trees, store snapshots, and test
 * fixtures.
 *
 * The generic signatures are typing seams over a structural implementation:
 * pass the tree's NODE UNION as the type argument (e.g.
 * `findNodeById<SnapshotNode>(root, id)`) when the argument has been
 * control-flow narrowed to a single variant, so results type as the union.
 */

interface TreeWalkNode {
  readonly id: string;
  readonly children?: readonly TreeWalkNode[] | undefined;
}

/** Finds a node by id anywhere in the subtree rooted at `root`. */
export function findNodeById<T extends TreeWalkNode>(
  root: T | null | undefined,
  nodeId: string,
): T | null;
export function findNodeById(
  root: TreeWalkNode | null | undefined,
  nodeId: string,
): TreeWalkNode | null {
  if (!root) {
    return null;
  }
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Flattens the subtree rooted at `root` in depth-first order. */
export function flattenTree<T extends TreeWalkNode>(root: T | null | undefined): T[];
export function flattenTree(root: TreeWalkNode | null | undefined): TreeWalkNode[] {
  if (!root) {
    return [];
  }
  const result: TreeWalkNode[] = [root];
  for (const child of root.children ?? []) {
    result.push(...flattenTree(child));
  }
  return result;
}

/** Builds an id-keyed index of every node in the subtree rooted at `root`. */
export function buildNodeIndex<T extends TreeWalkNode>(
  root: T | null | undefined,
): Map<string, T>;
export function buildNodeIndex(root: TreeWalkNode | null | undefined): Map<string, TreeWalkNode> {
  const index = new Map<string, TreeWalkNode>();
  for (const node of flattenTree(root)) {
    index.set(node.id, node);
  }
  return index;
}

/** Finds the parent of `nodeId` in the subtree rooted at `root`. */
export function findParentNode<T extends TreeWalkNode>(
  root: T | null | undefined,
  nodeId: string,
): T | null;
export function findParentNode(
  root: TreeWalkNode | null | undefined,
  nodeId: string,
): TreeWalkNode | null {
  if (!root) {
    return null;
  }
  for (const child of root.children ?? []) {
    if (child.id === nodeId) {
      return root;
    }
    const found = findParentNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Filters `nodeIds` to the topmost members: drops any id that has an ancestor
 * (proper — the node itself is excluded) also present in `nodeIds`. Used to
 * avoid double-transforming a nested selection (e.g. moving a selected absolute
 * child inside a selected absolute parent would shift it twice). Ids not found
 * in the tree are kept. Preserves the input order.
 */
export function excludeNestedNodes<T extends TreeWalkNode>(
  root: T | null | undefined,
  nodeIds: readonly string[],
): string[] {
  const selected = new Set(nodeIds);
  return nodeIds.filter((nodeId) => {
    const path = findNodePath(root, nodeId);
    if (!path) {
      return true;
    }
    // `path` is [root, …ancestors, node]; drop the node itself, then keep this
    // id only when none of its ancestors are selected.
    return !path.slice(0, -1).some((ancestor) => selected.has(ancestor.id));
  });
}

/**
 * Collects the node chain from `root` down to `nodeId` (inclusive), or `null`
 * when the node is not in the tree. The last element is the node itself.
 */
export function findNodePath<T extends TreeWalkNode>(
  root: T | null | undefined,
  nodeId: string,
): T[] | null;
export function findNodePath(
  root: TreeWalkNode | null | undefined,
  nodeId: string,
): TreeWalkNode[] | null {
  if (!root) {
    return null;
  }
  if (root.id === nodeId) {
    return [root];
  }
  for (const child of root.children ?? []) {
    const path = findNodePath(child, nodeId);
    if (path) {
      return [root, ...path];
    }
  }
  return null;
}
