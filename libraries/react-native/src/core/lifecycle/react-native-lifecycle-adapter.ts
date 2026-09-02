import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import { AppState } from "react-native";

import { LifecycleAdapter, type LifecycleSubscription } from "./lifecycle-adapter";

type AppLifecycleState = string;

interface ReactNativeAppState {
  readonly currentState?: AppLifecycleState;
  addEventListener: (
    eventType: "change",
    listener: (nextState: AppLifecycleState) => void,
  ) => LifecycleSubscription;
}

/**
 * Default `LifecycleAdapter` implementation that bridges to React Native's
 * `AppState`.
 *
 * `subscribe` is deliberately synchronous. It used to resolve `AppState`
 * through `import("react-native")`, which made the returned effect
 * asynchronous — `VoidhashClient.init()` runs it while wiring automatic
 * lifecycle events, so the async effect died there and rejected `init()`
 * *after* the client had already been marked initialized. `react-native` is a
 * hard dependency of this package (the platform provider and the paywall hooks
 * import it statically), so nothing is gained by loading it lazily. The
 * defensive `AppState` check stays so environments that stub the module out
 * (unit tests, Node-only consumers) degrade to "no lifecycle events" instead
 * of throwing.
 */
export const ReactNativeLifecycleAdapter = Layer.succeed(LifecycleAdapter, {
  subscribe: (listener) =>
    Effect.sync(() => {
      const appState: ReactNativeAppState = AppState;
      if (!P.isFunction(appState.addEventListener)) {
        return Option.none();
      }

      const previousState = MutableRef.make(Option.fromNullishOr(appState.currentState));

      return Option.some(
        appState.addEventListener("change", (nextState) => {
          const prior = MutableRef.get(previousState);
          MutableRef.set(previousState, Option.some(nextState));
          listener(nextState, prior);
        }),
      );
    }),
});
