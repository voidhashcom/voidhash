/** Events emitted by a mutable motion value. */
export type MotionValueEventName = "change" | "renderRequest";

/** A mutable external value that can update visual output without a React render. */
export interface MotionValue<T> {
  get(): T;
  getPrevious(): T;
  set(value: T): void;
  on(eventName: MotionValueEventName, listener: (value: T) => void): () => void;
}

class MotionValueImpl<T> implements MotionValue<T> {
  #current: T;
  #previous: T;
  #listeners = new Map<MotionValueEventName, Set<(value: T) => void>>();

  constructor(initial: T) {
    this.#current = initial;
    this.#previous = initial;
  }

  get(): T {
    return this.#current;
  }

  getPrevious(): T {
    return this.#previous;
  }

  set(value: T): void {
    if (Object.is(value, this.#current)) {
      return;
    }
    this.#previous = this.#current;
    this.#current = value;
    for (const eventName of ["change", "renderRequest"] as const) {
      for (const listener of this.#listeners.get(eventName) ?? []) {
        listener(value);
      }
    }
  }

  on(eventName: MotionValueEventName, listener: (value: T) => void): () => void {
    const listeners = this.#listeners.get(eventName) ?? new Set<(value: T) => void>();
    listeners.add(listener);
    this.#listeners.set(eventName, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.#listeners.delete(eventName);
      }
    };
  }
}

/** Creates a mutable motion value. Its updates never schedule React state. */
export const motionValue = <T>(initial: T): MotionValue<T> => new MotionValueImpl(initial);

/** Returns whether `value` implements the motion-value protocol. */
export const isMotionValue = (value: unknown): value is MotionValue<unknown> =>
  typeof value === "object" && value !== null && "get" in value && "set" in value && "on" in value;
