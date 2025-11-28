import { z } from 'zod';
import type { NodeData } from '../schema';
import type { DesignerStoreState } from './types';

/**
 * Creates node-related actions for the designer store.
 * These actions manage the nodes synced via YJS.
 */
export function createNodeActions(storeState: DesignerStoreState) {
  const addNode = storeState.action(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    ({ doc, setBrowser, params }) => {
      const nodesMap = doc.getMap<NodeData>('nodes');
      nodesMap.set(params.id, params);

      // Auto-select the new node
      setBrowser({ selectedNodeId: params.id });
    }
  );

  const removeNode = storeState.action(
    z.object({ id: z.string() }),
    ({ doc, getState, setBrowser, params }) => {
      // Clear selection if deleting the selected node
      if (getState().selectedNodeId === params.id) {
        setBrowser({ selectedNodeId: null });
      }

      const nodesMap = doc.getMap<NodeData>('nodes');
      nodesMap.delete(params.id);
    }
  );

  const updateNode = storeState.action(
    z.object({
      id: z.string(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional()
    }),
    ({ doc, getState, params }) => {
      const currentNode = getState().nodes?.[params.id];
      if (!currentNode) return;

      const nodesMap = doc.getMap<NodeData>('nodes');
      nodesMap.set(params.id, {
        ...currentNode,
        ...params
      });
    }
  );

  return {
    addNode,
    removeNode,
    updateNode
  };
}

