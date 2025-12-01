import { z } from 'zod';
import { createTree, findSubtreeInTree, flattenTree } from '../utils/nodes';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */

// const unselectAllChildren = (storeState: DesignerStoreState) =>
//   storeState.action(
//     z.object({ id: z.string() }),
//     ({ params, setAwareness, getState }) => {
//       const tree = createTree(getState().nodes);
//       const nodeSubtree = findSubtreeInTree(tree, params.id);
//       if (!nodeSubtree) {
//         return;
//       }

//       const flattenedSubtree = flattenTree(nodeSubtree);
//       const nodeIdsToUnselect = flattenedSubtree
//         .map((node) => node.id)
//         .filter((id) => id !== params.id);

//       const selectedNodeIds = getState().selectedNodeIds.filter(
//         (id) => !nodeIdsToUnselect.includes(id)
//       );

//       setAwareness({ selectedNodeIds });

//       return selectedNodeIds;
//     }
//   );

export const selectNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ id: z.string(), many: z.boolean() }),
    ({ params, setAwareness, getState }) => {
      // If not selecting multiple nodes, clear the selection and select the new node
      if (!params.many) {
        setAwareness({ selectedNodeIds: [params.id] });
      }

      // Otherwise, combine the new selection
      const state = getState();
      const selectedNodeIds = state.selectedNodeIds;
      const nodes = state.nodes;
      const tree = createTree(nodes);
      const nodeSubtree = findSubtreeInTree(tree, params.id);
      if (!nodeSubtree) {
        return;
      }

      // Do not select if already selected as a child of another selected node
      const allSelectedNodeIdsAndSubnoteIds = new Set(
        selectedNodeIds.flatMap((id) => {
          const nodeSubtree = findSubtreeInTree(tree, id);
          if (!nodeSubtree) {
            return [];
          }
          return flattenTree(nodeSubtree).map((node) => node.id);
        })
      );

      if (allSelectedNodeIdsAndSubnoteIds.has(params.id)) {
        return;
      }

      // Remove all children of the newly selected node
      const flattenedSubtree = flattenTree(nodeSubtree);
      const nodeIdsToUnselect = flattenedSubtree
        .map((node) => node.id)
        .filter((id) => id !== params.id);

      const newSelectedNodeIds = [...selectedNodeIds, params.id].filter(
        (id) => !nodeIdsToUnselect.includes(id)
      );

      setAwareness({
        selectedNodeIds: Array.from(new Set(newSelectedNodeIds))
      });
    }
  );

export const unselectNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ id: z.string() }),
    ({ params, setAwareness, getState }) => {
      setAwareness({
        selectedNodeIds: getState().selectedNodeIds.filter(
          (id) => id !== params.id
        )
      });
    }
  );

export const clearSelection = (storeState: DesignerStoreState) =>
  storeState.action(z.object({}), ({ setAwareness }) => {
    setAwareness({ selectedNodeIds: [] });
  });

export const createSelectionActions = (storeState: DesignerStoreState) => ({
  selectNode: selectNode(storeState),
  unselectNode: unselectNode(storeState),
  clearSelection: clearSelection(storeState)
});
