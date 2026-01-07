/**
 * Panel commands using zustand-commander.
 *
 * These commands manage viewport panel dimensions (browser-only state).
 */

import { commander } from "../designer-commander";
import type { DesignerStoreState } from "../designer-store-state";

// =============================================================================
// Panel Commands
// =============================================================================

/**
 * Set the height of the top panel.
 */
export const setTopPanelHeight = commander.action<{ height: number }>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      viewport: {
        ...state.viewport,
        panels: {
          ...state.viewport.panels,
          top: { height: params.height },
        },
      },
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Set the height of the bottom panel.
 */
export const setBottomPanelHeight = commander.action<{ height: number }>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      viewport: {
        ...state.viewport,
        panels: {
          ...state.viewport.panels,
          bottom: { height: params.height },
        },
      },
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Set the width of the left panel.
 */
export const setLeftPanelWidth = commander.action<{ width: number }>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      viewport: {
        ...state.viewport,
        panels: {
          ...state.viewport.panels,
          left: { width: params.width },
        },
      },
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Set the width of the right panel.
 */
export const setRightPanelWidth = commander.action<{ width: number }>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      viewport: {
        ...state.viewport,
        panels: {
          ...state.viewport.panels,
          right: { width: params.width },
        },
      },
    } as Partial<DesignerStoreState>);
  }
);
