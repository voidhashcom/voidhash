import { Schema } from 'effect';
import { createColumnNode } from './nodes/column-node-actions';
import { createRowNode } from './nodes/row-node-actions';
import { createTextNode } from './nodes/text-node-actions';
import { selectNode, unselectNode } from './selection-actions';
import type { DesignerStoreState } from './types';

export const saveCanvasState = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      scale: Schema.Number,
      x: Schema.Number,
      y: Schema.Number
    }),
    ({ params, setBrowser, getState }) => {
      const state = getState();
      setBrowser({ canvas: { ...state.canvas, ...params } });
    }
  );

export const updateBoundingBox = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      id: Schema.String,
      boundingBox: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        width: Schema.Number,
        height: Schema.Number
      })
    }),
    ({ params, getState, setBrowser }) => {
      const state = getState();
      const boundingBoxes = { ...state.canvas.boundingBoxes };
      boundingBoxes[params.id] = params.boundingBox;
      setBrowser({ canvas: { ...state.canvas, boundingBoxes } });
    }
  );

export const nodeMouseEnter = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ id: Schema.String }),
    ({ params, setBrowser }) => {
      setBrowser({ highlightedNodeId: params.id });
      return {
        shouldPropagate: true
      };
    }
  );

export const nodeMouseOver = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ id: Schema.String }),
    ({ params, setBrowser, getState }) => {
      const state = getState();
      if (!state.highlightedNodeId) {
        setBrowser({ highlightedNodeId: params.id });
      }
      return {
        shouldPropagate: true
      };
    }
  );

export const nodeMouseLeave = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ id: Schema.String }),
    ({ params, getState, setBrowser }) => {
      if (getState().highlightedNodeId === params.id) {
        setBrowser({ highlightedNodeId: null });
      }
    }
  );

export const nodeClicked = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ id: Schema.String, shiftKey: Schema.Boolean }),
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

        case 'columns':
          dispatch(createColumnNode)({ parentId: params.id });
          break;

        case 'rows':
          dispatch(createRowNode)({ parentId: params.id });
          break;
      }
    }
  );

export const createCanvasActions = (storeState: DesignerStoreState) => ({
  nodeClicked: nodeClicked(storeState),
  nodeMouseEnter: nodeMouseEnter(storeState),
  nodeMouseOver: nodeMouseOver(storeState),
  nodeMouseLeave: nodeMouseLeave(storeState),
  saveCanvasState: saveCanvasState(storeState),
  updateBoundingBox: updateBoundingBox(storeState)
});
