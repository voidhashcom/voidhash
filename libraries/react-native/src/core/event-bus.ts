import type { SdkCustomer } from "@voidhash/api-spec";
import { Context } from "effect";

export interface CustomerFetchedEvent {
  type: "customer-fetched";
  customer: SdkCustomer;
}

export interface CustomerSignedOutEvent {
  type: "customer-signed-out";
}

export interface CustomerIdentifiedEvent {
  type: "customer-identified";
}

export interface FeatureFlagsFetchedEvent {
  flags: Array<{
    enabled: boolean;
    key: string;
    payload: unknown | null;
    variantKey: string | null;
  }>;
}

export interface VoidhashEvents {
  "customer-fetched": SdkCustomer;
  // biome-ignore lint/suspicious/noConfusingVoidType: it specifies that the event has no payload
  "customer-signed-out": void;
  // biome-ignore lint/suspicious/noConfusingVoidType: it specifies that the event has no payload
  "customer-identified": void;
  "feature-flags-fetched": FeatureFlagsFetchedEvent;
}

export type VoidhashClientEvent = keyof VoidhashEvents;

export class EventBus {
  private listeners: {
    [key in VoidhashClientEvent]: ((...args: VoidhashEvents[key][]) => void)[];
  } = {
    "customer-fetched": [],
    "customer-identified": [],
    "customer-signed-out": [],
    "feature-flags-fetched": [],
  };

  on<TEvent extends VoidhashClientEvent>(
    event: TEvent,
    listener: (...args: VoidhashEvents[TEvent][]) => void
  ) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(listener);

    return () => {
      (this.listeners[event] as ((
        ...args: VoidhashEvents[TEvent][]
      ) => void)[]) = this.listeners[event].filter((l) => l !== listener);
    };
  }

  emit<TEvent extends VoidhashClientEvent>(
    event: TEvent,
    ...args: VoidhashEvents[TEvent][]
  ) {
    for (const listener of this.listeners[event]) {
      listener(...args);
    }
  }
}

export class EventBusProvider extends Context.Tag(
  "rn-voidhash/EventBusProvider"
)<EventBusProvider, EventBus>() {}
