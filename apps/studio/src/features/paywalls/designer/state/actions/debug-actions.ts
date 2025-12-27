/**
 * Debug commands using zustand-commander.
 *
 * These commands manage debug settings (browser-only state).
 */

import { Schema } from 'effect';
import { commander } from '../designer-commander';
import type { DesignerStoreState } from '../designer-store-state';

// =============================================================================
// Debug Commands
// =============================================================================

/**
 * Set whether to show the grid overlay.
 */
export const setShowGrid = commander.action(
  Schema.Struct({ showGrid: Schema.Boolean }),
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      debug: {
        ...state.debug,
        showGrid: params.showGrid
      }
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Toggle the grid overlay visibility.
 */
export const toggleShowGrid = commander.action(
  (ctx) => {
    const state = ctx.getState();
    ctx.setState({
      debug: {
        ...state.debug,
        showGrid: !state.debug.showGrid
      }
    } as Partial<DesignerStoreState>);
  }
);
