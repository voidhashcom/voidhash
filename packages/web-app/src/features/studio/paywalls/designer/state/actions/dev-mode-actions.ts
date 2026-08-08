/**
 * Dev mode commands using zustand-commander.
 *
 * These commands manage dev mode settings (browser-only state).
 */

import { commander } from "../designer-commander";
import type { DevModeTab } from "../designer-store-state";

// =============================================================================
// Dev Mode Commands
// =============================================================================

/**
 * Toggle dev mode on/off.
 */
export const toggleDevMode = commander.action((ctx) => {
  const state = ctx.getState();
  ctx.setState({
    devMode: {
      ...state.devMode,
      enabled: !state.devMode.enabled,
    },
  });
});

/**
 * Set dev mode enabled state.
 */
export const setDevModeEnabled = commander.action<{ enabled: boolean }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    devMode: {
      ...state.devMode,
      enabled: params.enabled,
    },
  });
});

/**
 * Set the active dev mode tab.
 */
export const setDevModeTab = commander.action<{ tab: DevModeTab }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    devMode: {
      ...state.devMode,
      activeTab: params.tab,
    },
  });
});
