import { TextNode, type TextNodeData } from '@voidhash/dff';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

const textNodeClass = new TextNode();

export const createTextNode = (storeState: DesignerStoreState) =>
  createNodeAction<TextNodeData>(storeState, textNodeClass, {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateTextNode = (storeState: DesignerStoreState) =>
  updateNodeAction<TextNodeData>(storeState, textNodeClass);

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
  createTextNode: createTextNode(storeState),
  updateTextNode: updateTextNode(storeState)
});
