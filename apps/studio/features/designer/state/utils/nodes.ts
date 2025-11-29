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
    if ('parent' in node && node.parent) {
      const parentId = node.parent.id;
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

  return rootNode;
}

export function getNodesByParentId<TStateNodes extends DesignerStateNodes>(
  nodes: TStateNodes,
  parentId: string
): NodeDataWithoutRoot[] {
  return Object.values(nodes).filter(
    (n) => n.type !== 'root' && n.parent.id === parentId
  ) as NodeDataWithoutRoot[];
}
