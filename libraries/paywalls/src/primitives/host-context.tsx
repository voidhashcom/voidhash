import { createContext, type ReactNode, useContext } from "react";

import { domHostComponents } from "../renderer/dom-host";
import {
  domMotionPlatformAdapter,
  MotionPlatformContext,
} from "../motion/platform";
import type { MotionPlatformAdapter } from "../motion/types";
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
  /** Platform clock, measurement, and accessibility capability adapter. */
  motion?: MotionPlatformAdapter;
  children: ReactNode;
}

/**
 * Overrides the active renderer for a subtree. Pass `host` to target a
 * non-default platform; omit it to keep the DOM renderer.
 */
export const RendererProvider = ({
  host = domHostComponents,
  motion = domMotionPlatformAdapter,
  children,
}: RendererProviderProps): ReactNode => (
  <MotionPlatformContext.Provider value={motion}>
    <HostContext.Provider value={host}>{children}</HostContext.Provider>
  </MotionPlatformContext.Provider>
);
