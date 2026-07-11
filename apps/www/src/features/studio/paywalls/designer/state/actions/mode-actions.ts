/**
 * Mode commands using zustand-commander.
 *
 * These commands manage the designer mode (design vs preview).
 */

import { commander } from "../designer-commander";
import type { DesignerMode } from "../designer-store-state";

// =============================================================================
// Mode Commands
// =============================================================================

/**
 * Set the designer mode (design or preview).
 *
 * Switching to preview resets the preview zoom to 100%. The preview no longer
 * captures a document snapshot here — `PreviewCanvas` derives its snapshot
 * reactively from the live render root, so it always reflects the current
 * document (see `preview-canvas.tsx`).
 */
export const setMode = commander.action<{ mode: DesignerMode }>((ctx, params) => {
  ctx.setState({
    mode: params.mode,
    previewScale: 1,
  });
});

/**
 * Set the preview zoom scale.
 * Clamped between 0.5 (50%) and 2.0 (200%).
 */
export const setPreviewScale = commander.action<{ scale: number }>((ctx, params) => {
  // Clamp between 0.5 (50%) and 2.0 (200%)
  const clampedScale = Math.min(2, Math.max(0.5, params.scale));
  ctx.setState({
    previewScale: clampedScale,
  });
});
