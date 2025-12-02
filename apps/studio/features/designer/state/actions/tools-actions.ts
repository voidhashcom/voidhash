import { Schema } from 'effect';
import { AvailableToolsSchema } from '../schema';
import type { DesignerStoreState } from './types';

/**
 * Creates selection-related actions for the designer store.
 * These actions manage the currently selected node (browser-only state).
 */
export const setActiveTool = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ tool: AvailableToolsSchema }),
    ({ params, setBrowser }) => {
      setBrowser({ tools: { activeTool: params.tool } });
    }
  );

export const createToolsActions = (storeState: DesignerStoreState) => ({
  setActiveTool: setActiveTool(storeState)
});
