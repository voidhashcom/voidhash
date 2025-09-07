import type { Customer } from './networking/types';

export type VoidhashEvents = {
  'customer-fetched': Customer;
  // biome-ignore lint/suspicious/noConfusingVoidType: it specifies that the event has no payload
  'customer-signed-out': void;
  // biome-ignore lint/suspicious/noConfusingVoidType: it specifies that the event has no payload
  'customer-identified': void;
};

export type VoidhashClientEvent = keyof VoidhashEvents;

export class EventBus {
  private listeners: {
    [key in VoidhashClientEvent]: ((...args: VoidhashEvents[key][]) => void)[];
  } = {
    'customer-fetched': [],
    'customer-signed-out': [],
    'customer-identified': []
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
