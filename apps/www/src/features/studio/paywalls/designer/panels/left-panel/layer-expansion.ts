interface LayerTreeNode {
  id: string;
  children?: readonly LayerTreeNode[];
}

/** Returns every ancestor layer that must be expanded to reveal the selection. */
export function getExpandedLayerIdsForSelection(
  tree: LayerTreeNode,
  selectedNodeIds: readonly string[],
): Set<string> {
  const selectedIds = new Set(selectedNodeIds);
  const expandedIds = new Set<string>();

  const visit = (node: LayerTreeNode): boolean => {
    let containsSelection = selectedIds.has(node.id);

    for (const child of node.children ?? []) {
      if (visit(child)) {
        expandedIds.add(node.id);
        containsSelection = true;
      }
    }

    return containsSelection;
  };

  visit(tree);
  return expandedIds;
}
