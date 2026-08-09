/**
 * Panel commands using zustand-commander.
 *
 * These commands manage viewport panel dimensions (browser-only state).
 */

import { clampLeftPanelWidth, clampRightPanelWidth } from "../../panels/constants";
import { commander } from "../designer-commander";

// =============================================================================
// Panel Commands
// =============================================================================

/**
 * Set the height of the top panel.
 */
export const setTopPanelHeight = commander.action<{ height: number }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    viewport: {
      ...state.viewport,
      panels: {
        ...state.viewport.panels,
        top: { height: params.height },
      },
    },
  });
});

/**
 * Set the height of the bottom panel.
 */
export const setBottomPanelHeight = commander.action<{ height: number }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    viewport: {
      ...state.viewport,
      panels: {
        ...state.viewport.panels,
        bottom: { height: params.height },
      },
    },
  });
});

/**
 * Set the left (layers) panel width (px), clamped to the panel's min/max
 * bounds. Browser-only local state — high-frequency writes during a drag are
 * fine as they never touch the mimic document's undo history.
 */
export const setLeftPanelWidth = commander.action<{ width: number }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    viewport: {
      ...state.viewport,
      panels: {
        ...state.viewport.panels,
        left: { width: clampLeftPanelWidth(params.width) },
      },
    },
  });
});

/**
 * Set the right (properties) panel width (px), clamped to the panel's min/max
 * bounds. Browser-only local state, like {@link setLeftPanelWidth}.
 */
export const setRightPanelWidth = commander.action<{ width: number }>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    viewport: {
      ...state.viewport,
      panels: {
        ...state.viewport.panels,
        right: { width: clampRightPanelWidth(params.width) },
      },
    },
  });
});

/**
 * Mark a panel resize drag as active/inactive so panels positioned off another
 * panel's width can suspend their CSS position transitions for the drag.
 */
export const setPanelResizeActive = commander.action<{ active: boolean }>((ctx, { active }) => {
  const state = ctx.getState();
  if (state.viewport.panelResizeActive === active) {
    return;
  }
  ctx.setState({
    viewport: {
      ...state.viewport,
      panelResizeActive: active,
    },
  });
});
