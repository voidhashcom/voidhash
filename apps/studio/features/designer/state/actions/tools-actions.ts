import { z } from 'zod';
import { availableToolsSchema } from '../schema';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */
export const setActiveTool = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ tool: availableToolsSchema }),
    ({ params, setBrowser }) => {
      setBrowser({ tools: { activeTool: params.tool } });
    }
  );

export const createToolsActions = (storeState: DesignerStoreState) => ({
  setActiveTool: setActiveTool(storeState)
});
