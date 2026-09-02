import { useRef } from "react";

import type { DragAxis, DragControls, MotionGestureEvent } from "./types";

interface DragStartOptions {
  readonly snapToCursor?: boolean;
  readonly distanceThreshold?: number;
}

type DragStarter = (event: MotionGestureEvent, options: DragStartOptions | undefined) => void;

class DragControlsImpl implements DragControls {
  #starter: DragStarter | undefined;

  register(starter: DragStarter | undefined): void {
    this.#starter = starter;
  }

  start(event: MotionGestureEvent, options?: DragStartOptions): void {
    this.#starter?.(event, options);
  }
}

/** Creates controls that can start a draggable primitive from a separate handle. */
export const useDragControls = (): DragControls => {
  const controls = useRef<DragControlsImpl | null>(null);
  if (controls.current === null) controls.current = new DragControlsImpl();
  return controls.current;
};

/** Determines drag-versus-scroll ownership after a direction has been established. */
export const resolveDragGestureWinner = (input: {
  readonly drag: DragAxis | undefined;
  readonly direction: "x" | "y";
  readonly scrollAxis: "x" | "y" | undefined;
  readonly gesturePriority?: "auto" | "drag";
}): "drag" | "scroll" | "none" => {
  if (!input.drag || (input.drag !== true && input.drag !== input.direction)) return "none";
  if (
    !input.scrollAxis ||
    input.scrollAxis !== input.direction ||
    input.gesturePriority === "drag"
  ) {
    return "drag";
  }
  return "scroll";
};

/** Internal registration hook shared by the DOM drag adapter and public controls. */
export const useDragControlRegistration = (
  controls: DragControls | undefined,
  starter: DragStarter | undefined,
): void => {
  const concrete = controls instanceof DragControlsImpl ? controls : undefined;
  concrete?.register(starter);
};
