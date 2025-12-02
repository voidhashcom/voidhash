import { columnNode } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createColumnNode = (storeState: DesignerStoreState) =>
  createNodeAction(storeState, columnNode, {
    after: ({ dispatch, node }) => {
      // node is automatically typed as ColumnNodeData
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateColumnNode = (storeState: DesignerStoreState) =>
  updateNodeAction(storeState, columnNode);

export const createColumnNodeActions = (storeState: DesignerStoreState) => ({
  createColumnNode: createColumnNode(storeState),
  updateColumnNode: updateColumnNode(storeState)
});
