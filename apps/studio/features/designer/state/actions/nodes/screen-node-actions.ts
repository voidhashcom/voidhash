import { ScreenNode, type ScreenNodeData } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

const screenNodeClass = new ScreenNode();

export const createScreenNode = (storeState: DesignerStoreState) =>
  createNodeAction<ScreenNodeData>(storeState, screenNodeClass, {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateScreenNode = (storeState: DesignerStoreState) =>
  updateNodeAction<ScreenNodeData>(storeState, screenNodeClass);

export const createScreenNodeActions = (storeState: DesignerStoreState) => ({
  createScreenNode: createScreenNode(storeState),
  updateScreenNode: updateScreenNode(storeState)
});
