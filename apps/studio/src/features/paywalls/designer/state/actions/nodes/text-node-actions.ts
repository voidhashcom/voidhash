import type { VariableType, VariableTypeKey } from '@voidhash/dff';
import { createEditor, createYjsStorage, paywallDocument } from '@voidhash/dff';
import { Schema } from 'effect';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createTextNode = (storeState: DesignerStoreState) =>
  createNodeAction<'text'>(storeState, 'text', {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateTextNode = (storeState: DesignerStoreState) =>
  updateNodeAction<'text'>(storeState, 'text');

export const addTextNodeVariable = (storeState: DesignerStoreState) =>
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

export const removeTextNodeVariable = (storeState: DesignerStoreState) =>
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

export const updateTextNodeVariable = (storeState: DesignerStoreState) =>
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

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
  createTextNode: createTextNode(storeState),
  updateTextNode: updateTextNode(storeState),
  addTextNodeVariable: addTextNodeVariable(storeState),
  removeTextNodeVariable: removeTextNodeVariable(storeState),
  updateTextNodeVariable: updateTextNodeVariable(storeState)
});
