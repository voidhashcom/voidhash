import { useEffect, useMemo, useRef } from "react";

import { animateMotionValue } from "./animation";
import type { MotionValue } from "./value";
import { motionValue } from "./value";
import type { Transition } from "./types";

/** Creates one stable mutable motion value for the lifetime of a component. */
export const useMotionValue = <T>(initial: T): MotionValue<T> => {
  const value = useRef<MotionValue<T> | null>(null);
  if (value.current === null) {
    value.current = motionValue(initial);
  }
  return value.current;
};

/** Derives a motion value with a mapping function without subscribing React to frames. */
export function useTransform<T, U>(
  source: MotionValue<T>,
  transformer: (value: T) => U,
): MotionValue<U>;
/** Maps a numeric motion value from one range to another. */
export function useTransform(
  source: MotionValue<number>,
  inputRange: ReadonlyArray<number>,
  outputRange: ReadonlyArray<number>,
): MotionValue<number>;
export function useTransform<T, U>(
  source: MotionValue<T>,
  transformerOrInputRange: ((value: T) => U) | ReadonlyArray<number>,
  outputRange?: ReadonlyArray<number>,
): MotionValue<U> {
  const transformer = useMemo(() => {
    if (typeof transformerOrInputRange === "function") {
      return transformerOrInputRange;
    }
    const input = transformerOrInputRange;
    const output = outputRange ?? [];
    return ((value: T): U => {
      const number = value as unknown as number;
      if (input.length < 2 || output.length !== input.length) {
        return output[0] as U;
      }
      let index = input.length - 2;
      for (let candidate = 0; candidate < input.length - 1; candidate += 1) {
        if (number <= input[candidate + 1]!) {
          index = candidate;
          break;
        }
      }
      const start = input[index]!;
      const end = input[index + 1]!;
      const progress =
        end === start ? 0 : Math.min(1, Math.max(0, (number - start) / (end - start)));
      return (output[index]! + (output[index + 1]! - output[index]!) * progress) as U;
    }) as (value: T) => U;
  }, [outputRange, transformerOrInputRange]);
  const value = useMotionValue(transformer(source.get()));

  useEffect(
    () => source.on("change", (next) => value.set(transformer(next))),
    [source, transformer, value],
  );
  return value;
}

/** Smooths a numeric source with an interruptible spring, without React frame updates. */
export const useSpring = (
  source: MotionValue<number>,
  transition: Transition = {},
): MotionValue<number> => {
  const value = useMotionValue(source.get());
  useEffect(() => {
    let stop: () => void = () => undefined;
    const unsubscribe = source.on("change", (next) => {
      stop();
      stop = animateMotionValue(value, next, { ...transition, type: "spring" });
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, [source, transition, value]);
  return value;
};

/** Derives velocity in logical units per second from a numeric motion value. */
export const useVelocity = (source: MotionValue<number>): MotionValue<number> => {
  const velocity = useMotionValue(0);
  useEffect(() => {
    let time = typeof performance === "undefined" ? Date.now() : performance.now();
    let previous = source.get();
    return source.on("change", (next) => {
      const nextTime = typeof performance === "undefined" ? Date.now() : performance.now();
      const elapsed = Math.max(1, nextTime - time);
      velocity.set(((next - previous) / elapsed) * 1000);
      previous = next;
      time = nextTime;
    });
  }, [source, velocity]);
  return velocity;
};

/** Subscribes to motion values without coupling changes to a React render. */
export const useMotionValueEvent = <T>(
  value: MotionValue<T>,
  eventName: "change" | "renderRequest",
  listener: (value: T) => void,
): void => {
  useEffect(() => value.on(eventName, listener), [eventName, listener, value]);
};
