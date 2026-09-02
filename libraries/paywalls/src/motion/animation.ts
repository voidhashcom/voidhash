import type { MotionValue } from "./value";
import type { MotionPlatformAdapter, Transition } from "./types";

/** A deterministic frame source used by animation contract tests and platform adapters. */
export interface FrameDriver {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(frame: number): void;
}

/** Creates a manual frame driver. Advance it explicitly with `step`. */
export const createManualFrameDriver = (): FrameDriver & { step(time: number): void } => {
  let now = 0;
  let nextId = 0;
  const callbacks = new Map<number, (time: number) => void>();
  return {
    now: () => now,
    requestFrame: (callback) => {
      nextId += 1;
      callbacks.set(nextId, callback);
      return nextId;
    },
    cancelFrame: (frame) => {
      callbacks.delete(frame);
    },
    step: (time) => {
      now = time;
      const frameCallbacks = [...callbacks.values()];
      callbacks.clear();
      for (const callback of frameCallbacks) {
        callback(time);
      }
    },
  };
};

/** Browser-safe default frame driver. It does not read browser globals at module evaluation. */
export const defaultFrameDriver: FrameDriver = {
  now: () => (typeof performance === "undefined" ? Date.now() : performance.now()),
  requestFrame: (callback) =>
    typeof requestAnimationFrame === "undefined"
      ? (setTimeout(() => callback(Date.now()), 16) as unknown as number)
      : requestAnimationFrame(callback),
  cancelFrame: (frame) => {
    if (typeof cancelAnimationFrame === "undefined") {
      clearTimeout(frame);
    } else {
      cancelAnimationFrame(frame);
    }
  },
};

/** Converts a renderer adapter into the generic animation frame driver. */
export const frameDriverFromAdapter = (adapter: MotionPlatformAdapter): FrameDriver => adapter;

const ease = (value: number, definition: Transition["ease"]): number => {
  switch (definition) {
    case "easeIn":
      return value * value;
    case "easeOut":
      return 1 - (1 - value) * (1 - value);
    case "easeInOut":
      return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
    default:
      return value;
  }
};

/** Starts an interruptible numeric tween or spring and returns its cancellation function. */
export const animateMotionValue = (
  value: MotionValue<number>,
  target: number,
  transition: Transition = {},
  driver: FrameDriver = defaultFrameDriver,
  reducedMotion = false,
  onComplete?: () => void,
): (() => void) => {
  if (reducedMotion || Object.is(value.get(), target)) {
    value.set(target);
    onComplete?.();
    return () => undefined;
  }

  let cancelled = false;
  let frame: number | undefined;
  const from = value.get();
  const startedAt = driver.now() + (transition.delay ?? 0) * 1000;
  const type = transition.type ?? "tween";
  const duration = Math.max(0.001, transition.duration ?? 0.3) * 1000;
  let position = from;
  let velocity = transition.velocity ?? 0;
  let previousTime = startedAt;

  const finish = () => {
    value.set(target);
    onComplete?.();
  };

  const tick = (time: number) => {
    if (cancelled) {
      return;
    }
    if (time < startedAt) {
      frame = driver.requestFrame(tick);
      return;
    }
    if (type === "tween") {
      const progress = Math.min(1, (time - startedAt) / duration);
      value.set(from + (target - from) * ease(progress, transition.ease));
      if (progress >= 1) {
        finish();
      } else {
        frame = driver.requestFrame(tick);
      }
      return;
    }

    const delta = Math.min(0.064, Math.max(0.001, (time - previousTime) / 1000));
    previousTime = time;
    const stiffness = transition.stiffness ?? 170;
    const damping = transition.damping ?? 26;
    const mass = transition.mass ?? 1;
    const acceleration = (stiffness * (target - position) - damping * velocity) / mass;
    velocity += acceleration * delta;
    position += velocity * delta;
    value.set(position);
    if (
      Math.abs(target - position) <= (transition.restDelta ?? 0.01) &&
      Math.abs(velocity) <= (transition.restSpeed ?? 0.01)
    ) {
      finish();
    } else {
      frame = driver.requestFrame(tick);
    }
  };

  frame = driver.requestFrame(tick);
  return () => {
    cancelled = true;
    if (frame !== undefined) {
      driver.cancelFrame(frame);
    }
  };
};
