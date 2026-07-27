"use client";

/**
 * The reactive selection channel a built-in panel definition reads to learn
 * WHICH nodes it edits.
 *
 * The wire {@link PanelSessionInputs} only carry `selection.count` (the sandbox
 * never sees host node ids), so a trusted built-in definition — which resolves
 * node data straight from the store — needs the selected node ids over a
 * separate host seam. This is that seam: a tiny subscribable holder the host
 * ({@link ../builtin-panel-host.BuiltinPanelHost}) provides once per session via
 * `wrap` (stable identity, so pushing a new selection NEVER remounts the
 * session) and updates on every selection change. A definition subscribes with
 * {@link useDefinitionSelection} via `useSyncExternalStore`, so a selection
 * change re-renders the definition inside the reconciler exactly like a store
 * change does — without a source-identity change.
 *
 * This carries no serializable form and never crosses the sandbox boundary; a
 * code-component panel learns its selection through the wire `selection` input,
 * not this context.
 */
import { createContext, useContext, useSyncExternalStore } from "react";

/** The current selection a definition edits: the selected node ids. */
export interface DefinitionSelection {
  /** The selected node ids, in selection order (empty when nothing is selected). */
  readonly nodeIds: readonly string[];
}

/**
 * A subscribable selection holder. Stable identity across the host session; its
 * snapshot changes (new object) only when the selection actually changes, so
 * `useSyncExternalStore` re-renders subscribers precisely once per real change.
 */
export interface DefinitionSelectionStore {
  /** Reads the current selection snapshot (stable identity between changes). */
  getSnapshot(): DefinitionSelection;
  /** Subscribes to selection changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Publishes a new selection (a no-op when the node ids are unchanged). */
  setNodeIds(nodeIds: readonly string[]): void;
}

/**
 * Creates a {@link DefinitionSelectionStore} seeded with `initialNodeIds`. The
 * host owns one per panel session; the definition only reads it.
 */
export function createDefinitionSelectionStore(
  initialNodeIds: readonly string[],
): DefinitionSelectionStore {
  let snapshot: DefinitionSelection = { nodeIds: initialNodeIds };
  const listeners = new Set<() => void>();
  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setNodeIds(nodeIds) {
      const current = snapshot.nodeIds;
      if (
        current.length === nodeIds.length &&
        current.every((id, index) => id === nodeIds[index])
      ) {
        return;
      }
      snapshot = { nodeIds };
      for (const listener of listeners) listener();
    },
  };
}

const DefinitionSelectionContext = createContext<DefinitionSelectionStore | null>(null);

/** Provides a {@link DefinitionSelectionStore} to a panel definition subtree. */
export const DefinitionSelectionProvider = DefinitionSelectionContext.Provider;

/**
 * Reads the current selection inside a built-in panel definition, re-rendering
 * on every selection change. Throws when no host provided the selection store
 * (a built-in definition must run under a host that installs the provider via
 * `wrap`).
 */
export function useDefinitionSelection(): DefinitionSelection {
  const store = useContext(DefinitionSelectionContext);
  if (!store) {
    throw new Error(
      "useDefinitionSelection must be used inside a DefinitionSelectionProvider (built-in panel host)",
    );
  }
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
