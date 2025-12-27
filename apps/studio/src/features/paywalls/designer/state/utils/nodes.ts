import type { Primitive } from '@voidhash/mimic';
import type { PaywallDesignerStoreType } from '../designer-store';
import type {
  DesignerStateNodes,
  NodeData,
  NodeDataWithoutRoot
} from '../schema';

type TreeNode<T extends NodeData> = T & {
  children: TreeNode<T>[];
};

export function createTree<TStateNodes extends DesignerStateNodes>(
  nodes: TStateNodes
): TreeNode<TStateNodes[string]> {
  // Create a map to store nodes with their children
  const nodeMap = new Map<string, TreeNode<TStateNodes[string]>>();
  const childrenMap = new Map<
    string,
    Array<{ nodeId: string; index: string }>
  >();

  // First pass: create all nodes and collect children
  for (const node of Object.values(nodes)) {
    const treeNode = {
      ...node,
      children: []
    } as unknown as TreeNode<TStateNodes[string]>;
    nodeMap.set(node.id, treeNode);

    // If node has a parent (non-root nodes have parentId), add it to the children map
    if (node.type !== 'root') {
      const nodeWithParent = node as NodeDataWithoutRoot;
      const parentId = nodeWithParent.parentId;
      if (parentId && !childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      if (parentId) {
        const parentChildren = childrenMap.get(parentId);
        if (parentChildren) {
          // Use pos for ordering since mimic uses pos for fractional indexing
          parentChildren.push({
            nodeId: node.id,
            index: nodeWithParent.pos ?? ''
          });
        }
      }
    }
  }

  // Second pass: build the tree structure and sort children by fractional index
  for (const [parentId, children] of childrenMap) {
    const parentNode = nodeMap.get(parentId);
    if (parentNode) {
      // Sort children by fractional index
      const sortedChildren = children
        .sort((a, b) => {
          // Compare fractional indices lexicographically
          return a.index.localeCompare(b.index);
        })
        .map(({ nodeId }) => nodeMap.get(nodeId))
        .filter(
          (node): node is TreeNode<TStateNodes[string]> => node !== undefined
        );

      parentNode.children = sortedChildren;
    }
  }

  // Find and return the root node (there's always exactly one)
  const rootNode = Array.from(nodeMap.values()).find(
    (node) => node.type === 'root'
  );

  if (!rootNode) {
    throw new Error('Root node not found in nodes');
  }

  return sortTree(rootNode);
}

/**
 * Finds a subtree in a tree by its id.
 * @param tree - The tree to search in.
 * @param id - The id of the node to find.
 * @returns The subtree or null if not found.
 */
export function findSubtreeInTree<TStateNodes extends DesignerStateNodes>(
  tree: TreeNode<TStateNodes[string]>,
  id: string
): TreeNode<TStateNodes[string]> | null {
  if (tree.id === id) {
    return tree;
  }
  if (tree.children) {
    for (const child of tree.children) {
      const found = findSubtreeInTree(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function sortTree<T extends NodeData>(tree: TreeNode<T>): TreeNode<T> {
  if (tree.children && tree.children.length > 0) {
    tree.children.sort((a, b) => {
      // Use pos for ordering since mimic uses pos for fractional indexing
      const indexA = 'pos' in a ? (a.pos as string) ?? '' : '';
      const indexB = 'pos' in b ? (b.pos as string) ?? '' : '';

      // Standard lexicographical string comparison
      if (indexA < indexB) {
        return -1;
      }
      if (indexA > indexB) {
        return 1;
      }
      return 0;
    });

    for (const child of tree.children) {
      sortTree(child);
    }
  }

  return tree;
}

export function flattenTree<TStateNodes extends DesignerStateNodes>(
  tree: TreeNode<TStateNodes[string]>
): TreeNode<TStateNodes[string]>[] {
  return [tree, ...tree.children.flatMap((child) => flattenTree(child))];
}

export function getNodesByParentId<TStateNodes extends DesignerStateNodes>(
  nodes: TStateNodes,
  parentId: string
): NodeDataWithoutRoot[] {
  return Object.values(nodes ?? {}).filter(
    (n) => n.type !== 'root' && (n as NodeDataWithoutRoot).parentId === parentId
  ) as NodeDataWithoutRoot[];
}

type StoreData = PaywallDesignerStoreType;

const getNodeByIdInSnapshot = (
  snapshot: Primitive.TreeNodeSnapshot<Primitive.AnyTreeNodePrimitive>,
  id: string
) => {
  if (snapshot.id === id) {
    return snapshot;
  }
  if (snapshot.children) {
    for (const child of snapshot.children) {
      const found = getNodeByIdInSnapshot(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

export const getNodeById = (
  state: ReturnType<StoreData['getState']>,
  id: string
) => {
  const treeSnapshot = state.mimic.snapshot;
  if (!treeSnapshot) {
    return null;
  }
  return getNodeByIdInSnapshot(treeSnapshot, id);
};
