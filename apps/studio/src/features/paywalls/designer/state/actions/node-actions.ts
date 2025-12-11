import {
  createEditor,
  createYjsStorage,
  paywallDocument,
  type SerializedNodes
} from '@voidhash/dff';
import { Schema } from 'effect';
import type * as Y from 'yjs';
import { clearSelection, selectNode } from './selection-actions';
import type { DesignerStoreState } from './types';

/**
 * Creates an Editor with YjsStorage for the given Y.Doc.
 */
function createEditorForDoc(doc: Y.Doc) {
  const storage = createYjsStorage(doc, paywallDocument);
  return createEditor(paywallDocument, { storage });
}

/**
 * Clipboard data format for cross-tab support.
 */
type ClipboardData = SerializedNodes & {
  __voidhash: true;
};

/**
 * Container node types that can accept children.
 */
const CONTAINER_TYPES = new Set(['root', 'screen', 'flex']);

/**
 * Checks if a node type is a container that can accept children.
 */
function isContainerType(nodeType: string): boolean {
  return CONTAINER_TYPES.has(nodeType);
}

/**
 * Parses clipboard data from text.
 * Returns null if the data is not valid voidhash clipboard data.
 */
function parseClipboardData(text: string): ClipboardData | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.__voidhash && Array.isArray(parsed.nodes)) {
      return parsed as ClipboardData;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/**
 * Deletes selected nodes and all their descendants.
 * Prevents deletion of root and screen nodes.
 * Uses editor.commands.deleteSubtree for recursive deletion.
 */
export const deleteNodes = (storeState: DesignerStoreState) =>
  storeState.action(Schema.Struct({}), ({ getState, doc, dispatch }) => {
    const state = getState();
    const { selectedNodeIds, nodes } = state;

    if (selectedNodeIds.length === 0) {
      return;
    }

    const editor = createEditorForDoc(doc);

    for (const selectedId of selectedNodeIds) {
      const node = nodes[selectedId];
      if (!node) {
        continue;
      }

      // Prevent deletion of root and screen nodes
      if (node.type === 'root' || node.type === 'screen') {
        continue;
      }

      try {
        editor.commands.deleteSubtree(selectedId);
      } catch {
        // Node might already be deleted (e.g., as a descendant)
      }
    }

    // Clear selection after deletion
    dispatch(clearSelection)({});
  });

/**
 * Copies selected nodes and all their descendants to the clipboard.
 * Prevents copying root or screen nodes.
 * Uses editor.serialization.serializeNodes.
 */
export const copyNodes = (storeState: DesignerStoreState) =>
  storeState.action(Schema.Struct({}), async ({ getState, doc }) => {
    const state = getState();
    const { selectedNodeIds, nodes } = state;

    if (selectedNodeIds.length === 0) {
      return;
    }

    // Filter out root and screen nodes
    const nodeIdsToCopy = selectedNodeIds.filter((id) => {
      const node = nodes[id];
      return node && node.type !== 'root' && node.type !== 'screen';
    });

    if (nodeIdsToCopy.length === 0) {
      return;
    }

    // Use editor serialization
    const editor = createEditorForDoc(doc);
    const serialized = editor.serialization.serializeNodes(nodeIdsToCopy);

    if (serialized.nodes.length === 0) {
      return;
    }

    // Add voidhash marker and write to clipboard
    const clipboardData: ClipboardData = {
      __voidhash: true,
      ...serialized
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(clipboardData));
    } catch {
      // Clipboard API might not be available (e.g., non-HTTPS)
    }
  });

/**
 * Cuts selected nodes (copies then deletes them).
 */
export const cutNodes = (storeState: DesignerStoreState) =>
  storeState.action(Schema.Struct({}), async ({ dispatch }) => {
    // Copy first
    await dispatch(copyNodes)({});

    // Then delete
    dispatch(deleteNodes)({});
  });

/**
 * Pastes nodes from clipboard.
 * Smart paste: if selected node is a container, paste as child; otherwise paste at original parent.
 * Uses editor.serialization.deserializeNodes for ID regeneration and index management.
 */
export const pasteNodes = (storeState: DesignerStoreState) =>
  storeState.action(Schema.Struct({}), async ({ getState, doc, dispatch }) => {
    // Read from clipboard
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      return;
    }

    // Parse clipboard data
    const clipboardData = parseClipboardData(clipboardText);
    if (!clipboardData || clipboardData.nodes.length === 0) {
      return;
    }

    const state = getState();
    const { selectedNodeIds, nodes } = state;

    // Determine paste location (smart paste)
    let targetParentId: string;

    if (selectedNodeIds.length > 0) {
      const firstSelectedId = selectedNodeIds[0];
      if (!firstSelectedId) {
        return;
      }
      const selectedNode = nodes[firstSelectedId];

      if (
        selectedNode &&
        isContainerType(selectedNode.type) &&
        selectedNode.type !== 'root'
      ) {
        // Paste as child of selected container
        targetParentId = firstSelectedId;
      } else if (clipboardData.originalParentId) {
        // Paste at original parent
        targetParentId = clipboardData.originalParentId;
      } else {
        return;
      }
    } else if (clipboardData.originalParentId) {
      // No selection, paste at original parent
      targetParentId = clipboardData.originalParentId;
    } else {
      return;
    }

    // Verify target parent exists
    if (!nodes[targetParentId]) {
      return;
    }

    // Use editor serialization to deserialize nodes
    const editor = createEditorForDoc(doc);
    const newRootIds = editor.serialization.deserializeNodes(clipboardData, {
      parentId: targetParentId
    });

    if (newRootIds.length === 0) {
      return;
    }

    const newRootNodeId = newRootIds[0];
    if (!newRootNodeId) {
      throw new Error('No new root node id even though there should be one');
    }
    // Select newly pasted nodes
    dispatch(clearSelection)({});
    dispatch(selectNode)({ id: newRootNodeId, many: false });

    for (let i = 1; i < newRootIds.length; i++) {
      const newRootNodeIdAtIndex = newRootIds[i];
      if (!newRootNodeIdAtIndex) {
        throw new Error('No new root node id even though there should be one');
      }
      dispatch(selectNode)({ id: newRootNodeIdAtIndex, many: true });
    }
  });

export const createNodeActions = (storeState: DesignerStoreState) => ({
  deleteNodes: deleteNodes(storeState),
  copyNodes: copyNodes(storeState),
  cutNodes: cutNodes(storeState),
  pasteNodes: pasteNodes(storeState)
});
