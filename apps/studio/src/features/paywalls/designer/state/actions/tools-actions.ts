/**
 * Tool commands using zustand-commander.
 *
 * These commands manage the currently active design tool.
 */

import { commander } from '../designer-commander';
import type { DesignerStoreState } from '../designer-store-state';
import type { AvailableTool } from '../schema';

// =============================================================================
// Tool Commands
// =============================================================================

/**
 * Set the currently active design tool.
 */
export const setActiveTool = commander.action<{ tool: AvailableTool }>(
  (ctx, params) => {
    ctx.setState({
      tools: { activeTool: params.tool }
    } as Partial<DesignerStoreState>);
  }
);
