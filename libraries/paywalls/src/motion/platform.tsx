import { createContext, useContext } from "react";

import type { MotionPlatformAdapter } from "./types";

/** DOM/WebView implementation of the platform clock and accessibility preference boundary. */
export const domMotionPlatformAdapter: MotionPlatformAdapter = {
  cancelFrame: (frame) => {
    if (typeof cancelAnimationFrame === "undefined") clearTimeout(frame);
    else cancelAnimationFrame(frame);
  },
  now: () => (typeof performance === "undefined" ? Date.now() : performance.now()),
  prefersReducedMotion: () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  requestFrame: (callback) =>
    typeof requestAnimationFrame === "undefined"
      ? (setTimeout(() => callback(Date.now()), 16) as unknown as number)
      : requestAnimationFrame(callback),
};

/** Static tree implementation: it never schedules motion or observes input. */
export const staticMotionPlatformAdapter: MotionPlatformAdapter = {
  cancelFrame: () => undefined,
  now: () => 0,
  prefersReducedMotion: () => true,
  requestFrame: () => 0,
};

export const MotionPlatformContext = createContext<MotionPlatformAdapter>(domMotionPlatformAdapter);

/** Returns the platform adapter installed by the active renderer. */
export const useMotionPlatform = (): MotionPlatformAdapter => useContext(MotionPlatformContext);
