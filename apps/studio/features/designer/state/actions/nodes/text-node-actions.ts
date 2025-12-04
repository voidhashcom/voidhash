import { textNode } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createTextNode = (storeState: DesignerStoreState) =>
  createNodeAction(storeState, textNode, {
    after: ({ dispatch, node }) => {
      // node is automatically typed as TextNodeData
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateTextNode = (storeState: DesignerStoreState) =>
  updateNodeAction(storeState, textNode);

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
  createTextNode: createTextNode(storeState),
  updateTextNode: updateTextNode(storeState)
});
