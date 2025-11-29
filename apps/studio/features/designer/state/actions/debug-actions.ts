import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates debug-related actions for the designer store.
 * These actions manage debug settings (browser-only state).
 */
export const setShowGrid = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ showGrid: z.boolean() }),
    ({ getState, setBrowser, params }) => {
      setBrowser({
        debug: {
          ...getState().debug,
          showGrid: params.showGrid
        }
      });
    }
  );

export const toggleShowGrid = (storeState: DesignerStoreState) =>
  storeState.action(({ getState, setBrowser }) => {
    setBrowser({
      debug: {
        ...getState().debug,
        showGrid: !getState().debug.showGrid
      }
    });
  });

export const createDebugActions = (storeState: DesignerStoreState) => ({
  setShowGrid: setShowGrid(storeState),
  toggleShowGrid: toggleShowGrid(storeState)
});
