import * as Context from "effect/Context";

import type { VoidhashEventMap, VoidhashEventName } from "../types";

export class EventBus {
  private listeners: {
    [TEvent in VoidhashEventName]: Array<(payload: VoidhashEventMap[TEvent]) => void>;
  } = {
    "analytics-flush-needed": [],
    "analytics-flushed": [],
    "analytics-partial-rejection": [],
    diagnostic: [],
    error: [],
    "feature-flags-updated": [],
    "identity-changed": [],
    initialized: [],
  };

  emit<TEvent extends VoidhashEventName>(event: TEvent, payload: VoidhashEventMap[TEvent]) {
    this.listeners[event].forEach((listener) => listener(payload));
  }

  off<TEvent extends VoidhashEventName>(
    event: TEvent,
    listener: (payload: VoidhashEventMap[TEvent]) => void,
  ) {
    const index = this.listeners[event].indexOf(listener);
    if (index >= 0) {
      this.listeners[event].splice(index, 1);
    }
  }

  on<TEvent extends VoidhashEventName>(
    event: TEvent,
    listener: (payload: VoidhashEventMap[TEvent]) => void,
  ) {
    this.listeners[event].push(listener);

    return () => {
      this.off(event, listener);
    };
  }
}

export class EventBusProvider extends Context.Service<EventBusProvider, EventBus>()(
  "web-voidhash/EventBusProvider",
) {}
