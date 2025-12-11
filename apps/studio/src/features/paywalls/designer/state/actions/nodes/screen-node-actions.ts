import type { VariableType, VariableTypeKey } from '@voidhash/dff';
import { createEditor, createYjsStorage, paywallDocument } from '@voidhash/dff';
import { Schema } from 'effect';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createScreenNode = (storeState: DesignerStoreState) =>
  createNodeAction<'screen'>(storeState, 'screen', {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateScreenNode = (storeState: DesignerStoreState) =>
  updateNodeAction<'screen'>(storeState, 'screen');

export const addScreenNodeVariable = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      nodeId: Schema.String,
      type: Schema.Literal('text', 'number', 'boolean', 'product'),
      name: Schema.String
    }),
    ({ params, doc }) => {
      const editor = createEditor(paywallDocument, {
        storage: createYjsStorage(doc, paywallDocument)
      });
      editor.commands.addVariable(
        params.nodeId,
        params.type as VariableTypeKey,
        params.name
      );
    }
  );

export const removeScreenNodeVariable = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      nodeId: Schema.String,
      variableName: Schema.String
    }),
    ({ params, doc }) => {
      const editor = createEditor(paywallDocument, {
        storage: createYjsStorage(doc, paywallDocument)
      });
      editor.commands.removeVariable(params.nodeId, params.variableName);
    }
  );

export const updateScreenNodeVariable = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      nodeId: Schema.String,
      variableName: Schema.String,
      newName: Schema.optional(Schema.String),
      newValue: Schema.optional(
        Schema.Union(
          Schema.String,
          Schema.Number,
          Schema.Boolean,
          Schema.Struct({
            type: Schema.Literal('product'),
            id: Schema.String
          })
        )
      )
    }),
    ({ params, doc }) => {
      const editor = createEditor(paywallDocument, {
        storage: createYjsStorage(doc, paywallDocument)
      });
      editor.commands.updateVariable(params.nodeId, params.variableName, {
        newName: params.newName,
        newValue: params.newValue as VariableType | undefined
      });
    }
  );

export const createScreenNodeActions = (storeState: DesignerStoreState) => ({
  createScreenNode: createScreenNode(storeState),
  updateScreenNode: updateScreenNode(storeState),
  addScreenNodeVariable: addScreenNodeVariable(storeState),
  removeScreenNodeVariable: removeScreenNodeVariable(storeState),
  updateScreenNodeVariable: updateScreenNodeVariable(storeState)
});
