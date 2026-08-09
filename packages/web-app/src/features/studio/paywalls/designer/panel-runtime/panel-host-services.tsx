"use client";

/**
 * Host services a built-in panel definition can reach from INSIDE the panel
 * reconciler root — the imperative escape hatches the wire tree cannot carry
 * (opening a modal sheet, awaiting a confirm dialog, toasting an error). The
 * built-in host ({@link ../panels/right-panel/builtin-panel-host}) provides a
 * concrete implementation via `wrap`, so a definition calls
 * `usePanelHostServices()` and gets a live host-backed surface.
 *
 * These are deliberately NOT props on the wire nodes: they are host-owned side
 * effects (portalled dialogs, sonner toasts) with no serializable form. A code-
 * component panel (Phase 3) will reach an equivalent surface through host intents
 * over the sandbox bridge, not through this context.
 */
import { createContext, useContext } from "react";

/**
 * A component-version update plan a definition asks the host to confirm before
 * applying (mirrors the component section's update AlertDialog). Kept structural
 * so the host can render a summary without importing section internals.
 */
export interface ComponentUpdatePlan {
  /** Human-readable title (e.g. "Update Card to v3?"). */
  readonly title: string;
  /** Optional body lines describing the consequences (removed props, reset preview state). */
  readonly details?: readonly string[];
  /** The confirm button label (defaults to "Update"). */
  readonly confirmLabel?: string;
}

/** The imperative host surface a built-in panel definition can call. */
export interface PanelHostServices {
  /** Opens the State Manager sheet for a node (the states section's Settings action). */
  openStateManager(nodeId: string): void;
  /** Awaits a host confirm dialog; resolves true if the user confirms. */
  confirmComponentUpdate(plan: ComponentUpdatePlan): Promise<boolean>;
  /** Surfaces a non-blocking error toast. */
  toastError(message: string): void;
}

const PanelHostServicesContext = createContext<PanelHostServices | null>(null);

/** Provides a {@link PanelHostServices} implementation to a subtree. */
export const PanelHostServicesProvider = PanelHostServicesContext.Provider;

/**
 * Reads the host services inside a panel definition. Throws when no host
 * provided them (a built-in definition must run under a host that installs the
 * provider via `wrap`).
 */
export function usePanelHostServices(): PanelHostServices {
  const services = useContext(PanelHostServicesContext);
  if (!services) {
    // oxlint-disable-next-line effect/noThrowStatement -- React context guard as documented above: a built-in panel definition rendered outside its host provider is a programming error, and a hook cannot return a failure channel.
    throw new Error(
      "usePanelHostServices must be used inside a PanelHostServicesProvider (built-in panel host)",
    );
  }
  return services;
}

/**
 * A safe accessor that returns `null` instead of throwing when no host is
 * present — for optional call sites (e.g. shared kit components that MAY run
 * outside a panel host).
 */
export function useOptionalPanelHostServices(): PanelHostServices | null {
  return useContext(PanelHostServicesContext);
}
