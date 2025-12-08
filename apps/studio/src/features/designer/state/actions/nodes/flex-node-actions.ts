import { FlexNode, type FlexNodeData } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

const flexNodeClass = new FlexNode();

export const createFlexNode = (storeState: DesignerStoreState) =>
  createNodeAction<FlexNodeData>(storeState, flexNodeClass, {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateFlexNode = (storeState: DesignerStoreState) =>
  updateNodeAction<FlexNodeData>(storeState, flexNodeClass);

export const createFlexNodeActions = (storeState: DesignerStoreState) => ({
  createFlexNode: createFlexNode(storeState),
  updateFlexNode: updateFlexNode(storeState)
});
