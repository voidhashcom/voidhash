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

    // If node has a parent (only screen nodes have parent, root nodes don't), add it to the children map
    if ('parentId' in node && node.parentId) {
      const parentId = node.parentId;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      const parentChildren = childrenMap.get(parentId);
      if (parentChildren) {
        parentChildren.push({
          nodeId: node.id,
          index: node.parent.index
        });
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
      if ('parent' in a && 'parent' in b) {
        const indexA = a.parent.index;
        const indexB = b.parent.index;

        // Standard lexicographical string comparison
        if (indexA < indexB) {
          return -1;
        }
        if (indexA > indexB) {
          return 1;
        }
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
    (n) => n.type !== 'root' && n.parent.id === parentId
  ) as NodeDataWithoutRoot[];
}
