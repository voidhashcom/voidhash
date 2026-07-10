import { Effect, Layer } from "effect";

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
 * Dynamically resolve `react-native`'s `AppState` so that the SDK degrades
 * gracefully in environments where React Native isn't installed (e.g. Jest
 * tests, Node-only consumers).
 */
const getReactNativeAppState = (): ReactNativeAppState | null => {
  try {
    const reactNative = require("react-native") as {
      readonly AppState?: ReactNativeAppState;
    };
    return reactNative.AppState ?? null;
  } catch {
    return null;
  }
};

/**
 * Default `LifecycleAdapter` implementation that bridges to React Native's
 * `AppState`. Owns the dynamic `require("react-native")` so the rest of the
 * SDK can stay React-Native-independent.
 */
export const ReactNativeLifecycleAdapter = Layer.succeed(LifecycleAdapter, {
  subscribe: (listener) =>
    Effect.sync(() => {
      const appState = getReactNativeAppState();
      if (!appState || typeof appState.addEventListener !== "function") {
        return null;
      }

      let previousState: AppLifecycleState | null = appState.currentState ?? null;

      const subscription = appState.addEventListener("change", (nextState) => {
        const prior = previousState;
        previousState = nextState;
        listener(nextState, prior);
      });

      return subscription;
    }),
});
