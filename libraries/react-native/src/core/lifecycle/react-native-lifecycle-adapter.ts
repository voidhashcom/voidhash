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
 * Lazily resolve `react-native`'s `AppState` so that the SDK degrades
 * gracefully in environments where React Native isn't installed (e.g. Jest
 * tests, Node-only consumers).
 */
const loadReactNativeAppState = (): Effect.Effect<ReactNativeAppState | null> =>
  Effect.tryPromise(() => import("react-native")).pipe(
    Effect.map(
      (reactNative) =>
        (reactNative as { readonly AppState?: ReactNativeAppState }).AppState ?? null,
    ),
    Effect.orElseSucceed(() => null),
  );

/**
 * Default `LifecycleAdapter` implementation that bridges to React Native's
 * `AppState`. Owns the lazy `import("react-native")` so the rest of the
 * SDK can stay React-Native-independent.
 */
export const ReactNativeLifecycleAdapter = Layer.succeed(LifecycleAdapter, {
  subscribe: (listener) =>
    Effect.gen(function* () {
      const appState = yield* loadReactNativeAppState();
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
