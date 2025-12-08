import { Schema } from 'effect';
import type { DesignerStoreState } from './types';

/**
 * Creates panel-related actions for the designer store.
 * These actions manage viewport panel dimensions (browser-only state).
 */

export const setTopPanelHeight = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ height: Schema.Number }),
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

export const setBottomPanelHeight = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ height: Schema.Number }),
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

export const setLeftPanelWidth = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ width: Schema.Number }),
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

export const setRightPanelWidth = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({ width: Schema.Number }),
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

export const createPanelActions = (storeState: DesignerStoreState) => ({
  setTopPanelHeight: setTopPanelHeight(storeState),
  setBottomPanelHeight: setBottomPanelHeight(storeState),
  setLeftPanelWidth: setLeftPanelWidth(storeState),
  setRightPanelWidth: setRightPanelWidth(storeState)
});
