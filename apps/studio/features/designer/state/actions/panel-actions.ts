import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates panel-related actions for the designer store.
 * These actions manage viewport panel dimensions (browser-only state).
 */
export function createPanelActions(storeState: DesignerStoreState) {
  const setTopPanelHeight = storeState.action(
    z.object({ height: z.number() }),
    ({ getState, setBrowser, params }) => {
      const viewport = getState().viewport;
      setBrowser({
        viewport: {
          ...viewport,
          panels: {
            ...viewport.panels,
            top: { height: params.height }
          }
        }
      });
    }
  );

  const setBottomPanelHeight = storeState.action(
    z.object({ height: z.number() }),
    ({ getState, setBrowser, params }) => {
      const viewport = getState().viewport;
      setBrowser({
        viewport: {
          ...viewport,
          panels: {
            ...viewport.panels,
            bottom: { height: params.height }
          }
        }
      });
    }
  );

  const setLeftPanelWidth = storeState.action(
    z.object({ width: z.number() }),
    ({ getState, setBrowser, params }) => {
      const viewport = getState().viewport;
      setBrowser({
        viewport: {
          ...viewport,
          panels: {
            ...viewport.panels,
            left: { width: params.width }
          }
        }
      });
    }
  );

  const setRightPanelWidth = storeState.action(
    z.object({ width: z.number() }),
    ({ getState, setBrowser, params }) => {
      const viewport = getState().viewport;
      setBrowser({
        viewport: {
          ...viewport,
          panels: {
            ...viewport.panels,
            right: { width: params.width }
          }
        }
      });
    }
  );

  return {
    setTopPanelHeight,
    setBottomPanelHeight,
    setLeftPanelWidth,
    setRightPanelWidth
  };
}

