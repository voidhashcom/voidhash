import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

/** Handle returned by {@link Connectivity.subscribe}. */
export interface ConnectivitySubscription {
  readonly remove: () => void;
}

/**
 * Optional reachability source. React Native ships no reachability API of its
 * own and the SDK adds no native dependency for one, so this is a port: apps
 * that already depend on a reachability library pass its state in through the
 * `connectivity` client option, and everyone else gets the no-op default,
 * where the breaker's own half-open probe is the recovery path.
 */
export class Connectivity extends Context.Service<
  Connectivity,
  {
    /**
     * Registers a listener for online/offline transitions. Returns `None`
     * when the host provided no reachability source.
     */
    readonly subscribe: (
      listener: (online: boolean) => void,
    ) => Effect.Effect<Option.Option<ConnectivitySubscription>>;
  }
>()("rn-voidhash/Connectivity") {
  /** Default: no reachability information available. */
  static readonly noop = Layer.succeed(Connectivity, {
    subscribe: () => Effect.succeed(Option.none()),
  });
}

/**
 * Host-facing shape of the `connectivity` client option: a subscribe function
 * returning an unsubscribe callback.
 */
export interface ConnectivityPort {
  readonly subscribe: (listener: (online: boolean) => void) => () => void;
}

/** Wraps a host-provided {@link ConnectivityPort} into a {@link Connectivity} layer. */
export const makeConnectivityLayer = (port: ConnectivityPort) =>
  Layer.succeed(Connectivity, {
    subscribe: (listener: (online: boolean) => void) =>
      Effect.sync(() => {
        const unsubscribe = port.subscribe(listener);
        return Option.some({ remove: unsubscribe });
      }),
  });
