import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */
export function createSelectionActions(storeState: DesignerStoreState) {
  const selectNode = storeState.action(
    z.object({ id: z.string().nullable() }),
    ({ setBrowser, params }) => {
      setBrowser({ selectedNodeId: params.id });
    }
  );

  const clearSelection = storeState.action(({ setBrowser }) => {
    setBrowser({ selectedNodeId: null });
  });

  return {
    selectNode,
    clearSelection
  };
}

