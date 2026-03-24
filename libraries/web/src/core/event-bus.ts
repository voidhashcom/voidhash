import { ServiceMap } from "effect";

import type { VoidhashEventMap, VoidhashEventName } from "../types";

export class EventBus {
  private listeners: {
    [TEvent in VoidhashEventName]: Set<
      (payload: VoidhashEventMap[TEvent]) => void
    >;
  } = {
    "analytics-flush-needed": new Set(),
    "analytics-flushed": new Set(),
    "analytics-partial-rejection": new Set(),
    error: new Set(),
    "feature-flags-updated": new Set(),
    "identity-changed": new Set(),
    initialized: new Set(),
  };

  emit<TEvent extends VoidhashEventName>(
    event: TEvent,
    payload: VoidhashEventMap[TEvent]
  ) {
    for (const listener of this.listeners[event] ?? []) {
      listener(payload);
    }
  }

  off<TEvent extends VoidhashEventName>(
    event: TEvent,
    listener: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    this.listeners[event]?.delete(listener);
  }

  on<TEvent extends VoidhashEventName>(
    event: TEvent,
    listener: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    this.listeners[event]?.add(listener);

    return () => {
      this.off(event, listener);
    };
  }
}

export class EventBusProvider extends ServiceMap.Service<
  EventBusProvider,
  EventBus
>()("web-voidhash/EventBusProvider") {}
