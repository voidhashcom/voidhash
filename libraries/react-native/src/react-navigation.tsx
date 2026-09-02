import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import React from "react";
import {
  type NavigationContainerRefWithCurrent,
  createNavigationContainerRef,
} from "@react-navigation/native";

import type { ScreenView } from "./core/screens/screen-tracker";
import { useVoidhashClient } from "./react/components/provider";

/**
 * Structural subset of React Navigation's route objects, so the pure helpers
 * below can be exercised with a fake container.
 */
export interface ScreenTrackingRoute {
  key?: string;
  name: string;
  params?: object;
  state?: ScreenTrackingNavigationState;
}

/** Structural subset of React Navigation's `NavigationState`. */
export interface ScreenTrackingNavigationState {
  index?: number;
  routes: ReadonlyArray<ScreenTrackingRoute>;
}

/* oxlint-disable effect/prefer-option-over-null -- structural mirror of React Navigation's container ref, whose methods return `undefined`; a real `NavigationContainerRef` must satisfy it without adapters. */
/** Structural subset of a React Navigation container ref that the hook reads. */
export interface ScreenTrackingContainerRef {
  getCurrentRoute(): ScreenTrackingRoute | undefined;
  getRootState(): ScreenTrackingNavigationState | undefined;
  isReady(): boolean;
  getCurrentOptions?(): object | undefined;
}
/* oxlint-enable effect/prefer-option-over-null */

type DefaultContainerRef = NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>;

export interface UseScreenTrackingOptions<Ref extends ScreenTrackingContainerRef> {
  /** An existing container ref to observe instead of the one the hook creates. */
  ref?: Ref;
}

export interface ScreenTrackingHandlers<Ref extends ScreenTrackingContainerRef> {
  /** Pass as `ref` on `NavigationContainer` (the supplied ref, or one the hook created). */
  ref: Ref;
  /** Pass as `onReady`; emits the initial screen. */
  onReady: () => void;
  /** Pass as `onStateChange`; emits on every focused-route change. */
  onStateChange: () => void;
}

/** The route `state` focuses: the one at `index`, or the last one when `index` is absent. */
const focusedRoute = (state: ScreenTrackingNavigationState): Option.Option<ScreenTrackingRoute> =>
  P.isNumber(state.index) ? Arr.get(state.routes, state.index) : Arr.last(state.routes);

/** Walks the focused route chain from the root state down to the leaf. */
export const focusedRouteChain = (
  state: Option.Option<ScreenTrackingNavigationState>,
): ReadonlyArray<ScreenTrackingRoute> =>
  Option.match(Option.flatMap(state, focusedRoute), {
    onNone: () => [],
    onSome: (route) => Arr.prepend(focusedRouteChain(Option.fromUndefinedOr(route.state)), route),
  });

const titleOf = (options: unknown): Option.Option<string> =>
  P.hasProperty(options, "title") && P.isString(options.title)
    ? Option.some(options.title)
    : Option.none();

const isRecord = (value: unknown): value is Record<string, unknown> => P.isObject(value);

/**
 * Builds the {@link ScreenView} for the container's focused leaf route, or
 * `None` when the container has no route yet.
 */
export const screenViewFromContainer = (
  container: ScreenTrackingContainerRef,
): Option.Option<ScreenView> => {
  const chain = focusedRouteChain(Option.fromUndefinedOr(container.getRootState()));
  const currentRoute = Option.fromUndefinedOr(container.getCurrentRoute());
  const leaf = Option.orElse(Arr.last(chain), () => currentRoute);
  return Option.flatMap(leaf, (route) => {
    const identity = Option.orElse(Option.fromUndefinedOr(route.key), () =>
      Option.flatMap(currentRoute, (current) => Option.fromUndefinedOr(current.key)),
    );
    const names = Arr.match(chain, {
      onEmpty: () => [route.name],
      onNonEmpty: (routes) => Arr.map(routes, (entry) => entry.name),
    });
    return Option.map(
      identity,
      (identity): ScreenView => ({
        identity,
        name: route.name,
        path: `/${names.join("/")}`,
        title: Option.getOrUndefined(titleOf(container.getCurrentOptions?.())),
        params: isRecord(route.params) ? route.params : undefined,
        source: "react-navigation",
      }),
    );
  });
};

/**
 * Screen tracking for React Navigation. Returns a container ref plus the
 * `onReady` and `onStateChange` callbacks to pass to `NavigationContainer`:
 *
 * ```tsx
 * const screenTracking = useScreenTracking();
 * <NavigationContainer
 *   ref={screenTracking.ref}
 *   onReady={screenTracking.onReady}
 *   onStateChange={screenTracking.onStateChange}
 * />
 * ```
 *
 * Apps that already own a ref pass it in with `{ ref }`; the callbacks are
 * plain functions that compose into existing handlers. Must be called below
 * `voidhash.Provider`.
 */
export function useScreenTracking<Ref extends ScreenTrackingContainerRef = DefaultContainerRef>(
  options: UseScreenTrackingOptions<Ref> = {},
): ScreenTrackingHandlers<Ref> {
  const client = useVoidhashClient();
  const [ownRef] = React.useState<DefaultContainerRef>(() => createNavigationContainerRef());
  // oxlint-disable-next-line effect/casting-awareness -- without a caller-supplied ref, `Ref` is the default and `ownRef` is that exact type; the generic cannot express that fallback without the assertion.
  const ref = (options.ref ?? ownRef) as Ref;

  const track = React.useCallback(() => {
    if (!ref.isReady()) {
      return;
    }
    const view = screenViewFromContainer(ref);
    if (Option.isSome(view)) {
      client.trackScreenView(view.value);
    }
  }, [client, ref]);

  return React.useMemo(() => ({ ref, onReady: track, onStateChange: track }), [ref, track]);
}
