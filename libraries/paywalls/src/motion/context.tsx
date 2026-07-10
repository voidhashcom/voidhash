import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { MotionConfigProps, ReducedMotion, Transition, TransitionByKey } from "./types";
import { useMotionPlatform } from "./platform";

interface MotionConfigSnapshot {
  readonly reducedMotion: ReducedMotion;
  readonly transition: Transition | TransitionByKey | undefined;
}

const DEFAULT_CONFIG: MotionConfigSnapshot = {
  reducedMotion: "user",
  transition: undefined,
};

const MotionConfigContext = createContext<MotionConfigSnapshot>(DEFAULT_CONFIG);

/** Configures inherited transition defaults and reduced-motion behaviour. */
export const MotionConfig = ({
  children,
  reducedMotion,
  transition,
}: MotionConfigProps): ReactNode => {
  const parent = useContext(MotionConfigContext);
  const value = useMemo<MotionConfigSnapshot>(
    () => ({
      reducedMotion: reducedMotion ?? parent.reducedMotion,
      transition: transition ?? parent.transition,
    }),
    [parent, reducedMotion, transition],
  );
  return <MotionConfigContext.Provider value={value}>{children}</MotionConfigContext.Provider>;
};

/** Returns inherited motion configuration for adapter implementations. */
export const useMotionConfig = (): MotionConfigSnapshot => useContext(MotionConfigContext);

/** Returns the resolved reduced-motion policy for the current motion subtree. */
export const useReducedMotion = (): boolean => {
  const { reducedMotion } = useMotionConfig();
  const platform = useMotionPlatform();
  if (reducedMotion === "always") {
    return true;
  }
  if (reducedMotion === "never") {
    return false;
  }
  return platform.prefersReducedMotion();
};
