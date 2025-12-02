import { rowNode } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createRowNode = (storeState: DesignerStoreState) =>
  createNodeAction(storeState, rowNode, {
    after: ({ dispatch, node }) => {
      // node is automatically typed as ColumnNodeData
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateRowNode = (storeState: DesignerStoreState) =>
  updateNodeAction(storeState, rowNode);

export const createColumnNodeActions = (storeState: DesignerStoreState) => ({
  createRowNode: createRowNode(storeState),
  updateRowNode: updateRowNode(storeState)
});
