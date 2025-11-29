import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */

export const selectNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ id: z.string(), many: z.boolean() }),
    ({ params, setAwareness, getState }) => {
      if (params.many) {
        setAwareness({
          selectedNodeIds: Array.from(
            new Set([...getState().selectedNodeIds, params.id])
          )
        });
      } else {
        setAwareness({ selectedNodeIds: [params.id] });
      }
    }
  );

export const unselectNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ id: z.string() }),
    ({ params, setAwareness, getState }) => {
      setAwareness({
        selectedNodeIds: getState().selectedNodeIds.filter(
          (id) => id !== params.id
        )
      });
    }
  );

export const clearSelection = (storeState: DesignerStoreState) =>
  storeState.action(z.object({}), ({ setAwareness }) => {
    setAwareness({ selectedNodeIds: [] });
  });

export const createSelectionActions = (storeState: DesignerStoreState) => ({
  selectNode: selectNode(storeState),
  unselectNode: unselectNode(storeState),
  clearSelection: clearSelection(storeState)
});
