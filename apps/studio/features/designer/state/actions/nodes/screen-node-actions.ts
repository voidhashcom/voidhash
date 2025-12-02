import { screenNode } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createScreenNode = (storeState: DesignerStoreState) =>
  createNodeAction(storeState, screenNode, {
    after: ({ dispatch, node }) => {
      // node is automatically typed as ColumnNodeData
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateScreenNode = (storeState: DesignerStoreState) =>
  updateNodeAction(storeState, screenNode);

export const createScreenNodeActions = (storeState: DesignerStoreState) => ({
  createScreenNode: createScreenNode(storeState),
  updateScreenNode: updateScreenNode(storeState)
});
