/**
 * localStorage persistence for the designer's user-resized panel widths.
 * Widths are loaded once when the designer store is created and saved when a
 * resize drag ends, so a user's layout survives reloads.
 */

import { Effect } from "effect";

import type { DesignerStoreState } from "../state/designer-store-state";

const STORAGE_KEY = "voidhash.designer.panelWidths";

/** Panel widths restored from a previous session; missing fields fall back to defaults. */
export interface PersistedPanelWidths {
  ai?: number;
  left?: number;
  right?: number;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Load the persisted panel widths, tolerating missing/corrupt storage. */
export function loadPanelWidths(): PersistedPanelWidths {
  if (typeof window === "undefined") {
    return {};
  }
  return Effect.runSync(
    Effect.try(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return {};
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        return {};
      }
      const record = parsed as Record<string, unknown>;
      return {
        ai: asFiniteNumber(record.ai),
        left: asFiniteNumber(record.left),
        right: asFiniteNumber(record.right),
      };
    }).pipe(Effect.orElseSucceed((): PersistedPanelWidths => ({}))),
  );
}

/** Persist the current widths of all resizable panels (called when a drag ends). */
export function persistPanelWidths(state: DesignerStoreState): void {
  if (typeof window === "undefined") {
    return;
  }
  // Storage may be unavailable (private mode, quota) — resizing still works, it just won't persist.
  Effect.runSync(
    Effect.try(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ai: state.ai.width,
          left: state.viewport.panels.left.width,
          right: state.viewport.panels.right.width,
        }),
      );
    }).pipe(Effect.ignore),
  );
}
