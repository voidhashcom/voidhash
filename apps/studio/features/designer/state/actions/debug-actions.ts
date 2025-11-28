import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates debug-related actions for the designer store.
 * These actions manage debug settings (browser-only state).
 */
export function createDebugActions(storeState: DesignerStoreState) {
  const setShowGrid = storeState.action(
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

  const toggleShowGrid = storeState.action(({ getState, setBrowser }) => {
    setBrowser({
      debug: {
        ...getState().debug,
        showGrid: !getState().debug.showGrid
      }
    });
  });

  return {
    setShowGrid,
    toggleShowGrid
  };
}

