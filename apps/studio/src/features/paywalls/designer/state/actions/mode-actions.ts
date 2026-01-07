/**
 * Mode commands using zustand-commander.
 *
 * These commands manage the designer mode (design vs preview).
 */

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import type {
  DesignerMode,
  DesignerStoreState,
} from "../designer-store-state";

// =============================================================================
// Mode Commands
// =============================================================================

/**
 * Set the designer mode (design or preview).
 * When switching to preview mode, captures the current document snapshot and resets zoom.
 */
export const setMode = commander.action<{ mode: DesignerMode }>(
  (ctx, params) => {
    const state = ctx.getState();

    // Capture snapshot only when entering preview mode
    const previewSnapshot =
      params.mode === "preview" ? (state.mimic.snapshot as SnapshotNode) : null;

    ctx.setState({
      mode: params.mode,
      previewScale: 1,
      previewSnapshot, // Reset zoom to 100% when switching modes
    } as Partial<DesignerStoreState>);
  }
);

/**
 * Set the preview zoom scale.
 * Clamped between 0.5 (50%) and 2.0 (200%).
 */
export const setPreviewScale = commander.action<{ scale: number }>(
  (ctx, params) => {
    // Clamp between 0.5 (50%) and 2.0 (200%)
    const clampedScale = Math.min(2, Math.max(0.5, params.scale));
    ctx.setState({
      previewScale: clampedScale,
    } as Partial<DesignerStoreState>);
  }
);
