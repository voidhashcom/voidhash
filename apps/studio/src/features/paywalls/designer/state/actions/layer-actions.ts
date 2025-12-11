import { createEditor, createYjsStorage, paywallDocument } from '@voidhash/dff';
import { Schema } from 'effect';
import type * as Y from 'yjs';
import type { DesignerStoreState } from './types';

/**
 * Creates an Editor with YjsStorage for the given Y.Doc.
 */
function createEditorForDoc(doc: Y.Doc) {
  const storage = createYjsStorage(doc, paywallDocument);
  return createEditor(paywallDocument, { storage });
}

/**
 * Moves a node to a new parent and/or position within siblings.
 * Uses editor.commands.moveNode for automatic index management.
 */
export const moveNode = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      nodeId: Schema.String,
      newParentId: Schema.String,
      beforeSiblingId: Schema.NullOr(Schema.String)
    }),
    ({ params, getState, doc }) => {
      const state = getState();
      const node = state.nodes?.[params.nodeId];

      if (!node || node.type === 'root') {
        return;
      }

      const newParent = state.nodes?.[params.newParentId];
      if (!newParent) {
        return;
      }

      // Use editor commands for move (handles validation and index generation)
      const editor = createEditorForDoc(doc);
      try {
        editor.commands.moveNode(params.nodeId, {
          parentId: params.newParentId,
          beforeSiblingId: params.beforeSiblingId
        });
      } catch {
        // Move failed (e.g., would create a cycle), silently ignore
      }
    }
  );

export const createLayerActions = (storeState: DesignerStoreState) => ({
  moveNode: moveNode(storeState)
});
