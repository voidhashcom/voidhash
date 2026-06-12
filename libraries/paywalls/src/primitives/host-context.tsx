import { createContext, type ReactNode, useContext } from "react";

import { domHostComponents } from "../renderer/dom-host";
import type { HostComponents } from "./types";

/**
 * The renderer registry. Primitives read their host implementation from here
 * so the platform can be swapped by wrapping a subtree in
 * {@link RendererProvider}.
 *
 * The default value is the DOM renderer: a paywall tree therefore renders on
 * the web with no explicit provider, while other targets (the preview node
 * tree, native views) are opt-in.
 */
const HostContext = createContext<HostComponents>(domHostComponents);

/** The active renderer's host components. */
export const useHost = (): HostComponents => useContext(HostContext);

export interface RendererProviderProps {
  host?: HostComponents;
  children: ReactNode;
}

/**
 * Overrides the active renderer for a subtree. Pass `host` to target a
 * non-default platform; omit it to keep the DOM renderer.
 */
export const RendererProvider = ({
  host = domHostComponents,
  children,
}: RendererProviderProps): ReactNode => (
  <HostContext.Provider value={host}>{children}</HostContext.Provider>
);
