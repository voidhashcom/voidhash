import z from 'zod';
import { createTextNode } from './nodes/text-node-actions';
import { selectNode, unselectNode } from './selection-actions';
import type { DesignerStoreState } from './types';

export const nodeClicked = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ id: z.string(), shiftKey: z.boolean() }),
    ({ params, getState, dispatch }) => {
      const state = getState();
      const tool = state.tools.activeTool;
      const clickedNode = state.nodes?.[params.id];
      if (!clickedNode) {
        return;
      }

      switch (tool) {
        case 'cursor': {
          const isSelected = state.selectedNodeIds.includes(params.id);
          if (isSelected) {
            if (params.shiftKey) {
              dispatch(unselectNode)({ id: params.id });
              return;
            }
            // If the node is already selected, do nothing
            return;
          }
          // Select the node
          dispatch(selectNode)({ id: params.id, many: params.shiftKey });
          break;
        }
        case 'text':
          dispatch(createTextNode)({ parentId: params.id });
          break;
      }
    }
  );

export const createCanvasActions = (storeState: DesignerStoreState) => ({
  nodeClicked: nodeClicked(storeState)
});
