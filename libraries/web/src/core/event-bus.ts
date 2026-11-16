import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

import type { VoidhashEventMap } from "../types";

/**
 * The public events and the SDK's own: `analytics-flush-needed` tells the
 * client that the flush interval elapsed.
 */
type SdkEventMap = VoidhashEventMap & { readonly "analytics-flush-needed": undefined };
type SdkEventName = keyof SdkEventMap;

/**
 * Reports an error a host listener threw, without throwing into the SDK: with
 * `reportError` where the platform has it, else from a separate task.
 */
const reportListenerError = (error: unknown) => {
  if (P.isFunction(globalThis.reportError)) {
    globalThis.reportError(error);
    return;
  }
  setTimeout(() => {
    throw error;
  }, 0);
};

export class EventBus {
  private listeners: {
    [TEvent in SdkEventName]: Array<(payload: SdkEventMap[TEvent]) => void>;
  } = {
    "analytics-consent-changed": [],
    "analytics-flush-needed": [],
    "analytics-flushed": [],
    "analytics-partial-rejection": [],
    diagnostic: [],
    error: [],
    "feature-flags-updated": [],
    "identity-changed": [],
    initialized: [],
  };

  /**
   * Calls every listener with `payload`. A listener that throws cannot stop
   * the others or the SDK work that emitted the event: its error is reported
   * the way the browser reports one from a DOM event listener. The listeners
   * are copied first, so one that unsubscribes itself does not skip the next.
   */
  emit<TEvent extends SdkEventName>(event: TEvent, payload: SdkEventMap[TEvent]) {
    Arr.forEach(this.listeners[event].slice(), (listener) => {
      const outcome = Result.try({ catch: (error) => error, try: () => listener(payload) });
      if (Result.isFailure(outcome)) reportListenerError(outcome.failure);
    });
  }

  off<TEvent extends SdkEventName>(
    event: TEvent,
    listener: (payload: SdkEventMap[TEvent]) => void,
  ) {
    const index = this.listeners[event].indexOf(listener);
    if (index >= 0) {
      this.listeners[event].splice(index, 1);
    }
  }

  on<TEvent extends SdkEventName>(event: TEvent, listener: (payload: SdkEventMap[TEvent]) => void) {
    this.listeners[event].push(listener);

    return () => {
      this.off(event, listener);
    };
  }
}

export class EventBusProvider extends Context.Service<EventBusProvider, EventBus>()(
  "web-voidhash/EventBusProvider",
) {}
