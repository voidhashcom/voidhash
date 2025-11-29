import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */
export function createSelectionActions(storeState: DesignerStoreState) {
  const selectNode = storeState.action(
    z.object({ id: z.string() }),
    ({ params, setAwareness }) => {
      setAwareness({ selectedNodeIds: [params.id] });
    }
  );

  const clearSelection = storeState.action(({ setAwareness }) => {
    setAwareness({ selectedNodeIds: [] });
  });

  return {
    selectNode,
    clearSelection
  };
}
