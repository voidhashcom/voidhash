import type { VariableType, VariableTypeKey } from '@voidhash/dff';
import { createEditor, createYjsStorage, paywallDocument } from '@voidhash/dff';
import { Schema } from 'effect';
import { createNodeAction, updateNodeAction } from '../core';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createFlexNode = (storeState: DesignerStoreState) =>
  createNodeAction<'flex'>(storeState, 'flex', {
    after: ({ dispatch, node }) => {
      dispatch(selectNode)({ id: node.id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  });

export const updateFlexNode = (storeState: DesignerStoreState) =>
  updateNodeAction<'flex'>(storeState, 'flex');

export const addFlexNodeVariable = (storeState: DesignerStoreState) =>
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

export const removeFlexNodeVariable = (storeState: DesignerStoreState) =>
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

export const updateFlexNodeVariable = (storeState: DesignerStoreState) =>
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

export const createFlexNodeActions = (storeState: DesignerStoreState) => ({
  createFlexNode: createFlexNode(storeState),
  updateFlexNode: updateFlexNode(storeState),
  addFlexNodeVariable: addFlexNodeVariable(storeState),
  removeFlexNodeVariable: removeFlexNodeVariable(storeState),
  updateFlexNodeVariable: updateFlexNodeVariable(storeState)
});
