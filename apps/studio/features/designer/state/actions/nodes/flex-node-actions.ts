import { flexNode } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createFlexNode = (storeState: DesignerStoreState) =>
  createNodeAction(storeState, flexNode, {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateFlexNode = (storeState: DesignerStoreState) =>
  updateNodeAction(storeState, flexNode);

export const createFlexNodeActions = (storeState: DesignerStoreState) => ({
  createFlexNode: createFlexNode(storeState),
  updateFlexNode: updateFlexNode(storeState)
});
