/**
 * AI panel commands using zustand-commander.
 *
 * These commands manage the Voidhash AI chat panel (browser-only state).
 */

import { PANEL_DIMENSIONS } from "../../panels/constants";
import { commander } from "../designer-commander";

// =============================================================================
// AI Panel Commands
// =============================================================================

/**
 * Toggle the Voidhash AI chat panel open/closed.
 */
export const toggleAiPanel = commander.action((ctx) => {
  const state = ctx.getState();
  ctx.setState({
    ai: {
      ...state.ai,
      panelOpen: !state.ai.panelOpen,
    },
  });
});

/**
 * Set the AI chat panel width (px), clamped to the panel's min/max bounds.
 * Browser-only local state — high-frequency writes during a drag are fine as
 * they never touch the mimic document's undo history.
 */
export const setAiPanelWidth = commander.action<{ width: number }>((ctx, { width }) => {
  const state = ctx.getState();
  const clamped = Math.max(
    PANEL_DIMENSIONS.AI_CHAT_MIN_WIDTH,
    Math.min(PANEL_DIMENSIONS.AI_CHAT_MAX_WIDTH, width),
  );
  ctx.setState({
    ai: {
      ...state.ai,
      width: clamped,
    },
  });
});
