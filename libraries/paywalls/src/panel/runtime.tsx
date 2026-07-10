/**
 * The React context that carries a {@link PanelContext} to the rendered panel
 * definition. The session rebuilds the context from a fresh
 * {@link PanelSessionInputs} snapshot on every host update and passes it here;
 * the definition reads it via {@link usePanelContext}.
 */
import { createContext, type ReactNode, useContext } from "react";

import type { PanelContext, PanelProps } from "./context";

const PanelRuntimeContext = createContext<PanelContext | null>(null);

export interface PanelRuntimeProviderProps {
  value: PanelContext;
  children: ReactNode;
}

/** Provides the {@link PanelContext} to a panel definition subtree. */
export const PanelRuntimeProvider = ({ value, children }: PanelRuntimeProviderProps): ReactNode => (
  <PanelRuntimeContext.Provider value={value}>{children}</PanelRuntimeContext.Provider>
);

/**
 * Reads the active {@link PanelContext}. Available to a panel definition and
 * any hooks it composes; throws outside a {@link PanelRuntimeProvider}.
 */
export const usePanelContext = <P extends PanelProps = PanelProps>(): PanelContext<P> => {
  const value = useContext(PanelRuntimeContext);
  if (value === null) {
    throw new Error("usePanelContext must be used inside a panel session");
  }
  return value as PanelContext<P>;
};
