/**
 * Awareness commands using zustand-commander.
 *
 * These commands manage ephemeral state shared via the presence protocol.
 * Cursor positions, user info, etc.
 */

import { commander } from "../designer-commander";
import { presenceInputFromSnapshot } from "../utils/presence";

// =============================================================================
// Awareness Commands
// =============================================================================

/**
 * Update the cursor position in presence. `null` clears the cursor (the
 * schema encodes "no cursor" as field absence).
 */
export const updateCursor = commander.action<{ x: number; y: number } | null>((ctx, params) => {
  const state = ctx.getState();
  const { mimic } = state;

  const currentPresence = mimic.document.presence?.self();
  if (currentPresence) {
    mimic.document.presence?.set({
      ...presenceInputFromSnapshot(currentPresence),
      cursor: params ?? undefined,
    });
  }
});

/**
 * Update user information in presence.
 */
export const updateUser = commander.action<{ name?: string; color?: string }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic } = state;

  const currentPresence = mimic.document.presence?.self();
  if (currentPresence) {
    mimic.document.presence?.set({
      ...presenceInputFromSnapshot(currentPresence),
      user: {
        ...currentPresence.user,
        ...params,
      },
    });
  }
});
