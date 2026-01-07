/**
 * Awareness commands using zustand-commander.
 *
 * These commands manage ephemeral state shared via the presence protocol.
 * Cursor positions, user info, etc.
 */

import { commander } from "../designer-commander";

// =============================================================================
// Awareness Commands
// =============================================================================

/**
 * Update the cursor position in presence.
 */
export const updateCursor = commander.action<{ x: number; y: number } | null>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    const currentPresence = mimic.document.presence?.self();
    if (currentPresence) {
      mimic.document.presence?.set({
        ...currentPresence,
        cursor: params,
      });
    }
  }
);

/**
 * Update user information in presence.
 */
export const updateUser = commander.action<{ name?: string; color?: string }>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    const currentPresence = mimic.document.presence?.self();
    if (currentPresence) {
      mimic.document.presence?.set({
        ...currentPresence,
        user: {
          ...currentPresence.user,
          ...params,
        },
      });
    }
  }
);
