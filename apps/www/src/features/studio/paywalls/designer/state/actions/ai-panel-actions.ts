/**
 * AI panel commands using zustand-commander.
 *
 * These commands manage the Voidhash AI chat panel (browser-only state).
 */

import { PANEL_DIMENSIONS } from "../../panels/constants";
import { commander } from "../designer-commander";
import type { AgentCanvasOperation } from "../designer-store-state";

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

/** Add or replace a transient operation shown by the canvas agent overlay. */
export const startAiCanvasOperation = commander.action<AgentCanvasOperation>((ctx, operation) => {
  const state = ctx.getState();
  ctx.setState({
    ai: {
      ...state.ai,
      operations: { ...state.ai.operations, [operation.id]: operation },
    },
  });
});

/** Remove one transient canvas operation if it is still active. */
export const finishAiCanvasOperation = commander.action<{ id: string }>((ctx, { id }) => {
  const state = ctx.getState();
  if (!(id in state.ai.operations)) {
    return;
  }
  const operations = { ...state.ai.operations };
  delete operations[id];
  ctx.setState({ ai: { ...state.ai, operations } });
});

/** Sets whether the designer agent is actively processing a turn. */
export const setAiWorking = commander.action<{ isWorking: boolean }>((ctx, { isWorking }) => {
  const state = ctx.getState();
  if (state.ai.isWorking === isWorking) {
    return;
  }
  ctx.setState({
    ai: {
      ...state.ai,
      isWorking,
    },
  });
});
