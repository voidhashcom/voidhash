import { useRef } from "react";

import type { MotionNodeHandle, MotionRef } from "./types";

/** Creates a renderer-neutral ref for a motion-capable primitive. */
export const useMotionRef = <T extends MotionNodeHandle = MotionNodeHandle>(): MotionRef<T> =>
  useRef<T | null>(null);
