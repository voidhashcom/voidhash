/**
 * Debug commands using zustand-commander.
 *
 * These commands manage debug settings (browser-only state).
 */

import { commander } from "../designer-commander";

// =============================================================================
// Debug Commands
// =============================================================================

/**
 * Set whether to show the grid overlay.
 */
export const setShowGrid = commander.action<{ showGrid: boolean }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    debug: {
      ...state.debug,
      showGrid: params.showGrid,
    },
  });
});

/**
 * Toggle the grid overlay visibility.
 */
export const toggleShowGrid = commander.action((ctx) => {
  const state = ctx.getState();
  ctx.setState({
    debug: {
      ...state.debug,
      showGrid: !state.debug.showGrid,
    },
  });
});
