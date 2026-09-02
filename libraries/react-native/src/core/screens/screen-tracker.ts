import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

import { SCREEN_PROPERTIES } from "../analytics/constants";

/** Integration that observed a screen transition. */
export type ScreenSource =
  | "expo-router"
  | "react-navigation"
  | "uikit"
  | "swiftui"
  | "android-activity"
  | "android-fragment"
  | "compose-navigation"
  | "manual";

/** One screen the user arrived on, as reported by an integration. */
export interface ScreenView {
  /**
   * Router-owned token identifying this screen instance (route key, pathname,
   * controller instance). Two views with the same identity are the same screen
   * and only the first one emits.
   */
  identity: string;
  /** Stable, low-cardinality screen identity. Never contains ids. */
  name: string;
  /** Concrete location, with dynamic segment values filled in. */
  path: string;
  /** Human title when the platform exposes one. */
  title?: string;
  /** Route params. Only forwarded when `includeParams` is on. */
  params?: Record<string, unknown>;
  source: ScreenSource;
}

export interface ScreenTrackerOptions {
  /** `false` turns every transition into a no-op. */
  enabled: boolean;
  /** Adds `$screen_params` to the emitted properties. */
  includeParams: boolean;
  /** Rewrites or drops a screen before it reaches the tracker. Return `None` to skip. */
  mapScreen?: (view: ScreenView) => Option.Option<ScreenView>;
  /** Clock used for `$previous_screen_duration_ms`. Defaults to `Date.now`. */
  now?: () => number;
}

export interface ScreenTracker {
  /**
   * Feeds one screen arrival through the state machine. Returns the `$screen`
   * properties to capture, or `None` when nothing should be emitted (tracking
   * disabled, same screen instance, or dropped by `mapScreen`).
   */
  transition: (view: ScreenView) => Option.Option<Record<string, unknown>>;
  /** Forgets the current screen so the next transition has `null` previous fields. */
  reset: () => void;
}

/** Client-side bound on `$screen_name` and `$screen_path`. */
export const SCREEN_NAME_MAX_LENGTH = 200;
/** Client-side bound on the number of `$screen_params` keys. */
export const SCREEN_PARAMS_MAX_KEYS = 20;

interface CurrentScreen {
  identity: string;
  name: string;
  path: string;
  arrivedAt: number;
}

const truncate = (value: string) => value.slice(0, SCREEN_NAME_MAX_LENGTH);

const coerceParam = (value: unknown): string =>
  P.isString(value)
    ? value
    : Array.isArray(value)
      ? value.map(coerceParam).join(",")
      : String(value);

const coerceParams = (params: Record<string, unknown>): Record<string, string> =>
  R.fromEntries(
    Arr.map(
      Arr.take(R.toEntries(params), SCREEN_PARAMS_MAX_KEYS),
      ([key, value]) => [key, coerceParam(value)] as const,
    ),
  );

/**
 * Creates the pure screen transition state machine shared by every screen
 * tracking integration. It owns only the previous-screen state; capturing the
 * returned properties is the caller's job.
 */
export function createScreenTracker(options: ScreenTrackerOptions): ScreenTracker {
  // oxlint-disable-next-line effect/use-clock-service -- synchronous, non-Effect state machine: the `now` option is the injection seam (tests pass a fake clock) and `Date.now` is only the production default.
  const now = options.now ?? Date.now;
  let state = Option.none<CurrentScreen>();

  const transition = (input: ScreenView): Option.Option<Record<string, unknown>> => {
    if (!options.enabled) {
      return Option.none();
    }
    const mappedView = options.mapScreen ? options.mapScreen(input) : Option.some(input);
    if (Option.isNone(mappedView)) {
      return Option.none();
    }
    const mapped = mappedView.value;
    if (Option.isSome(state) && state.value.identity === mapped.identity) {
      return Option.none();
    }

    const arrivedAt = now();
    const name = truncate(mapped.name);
    const path = truncate(mapped.path);
    const previous = Option.getOrNull(state);

    const properties: Record<string, unknown> = {
      [SCREEN_PROPERTIES.NAME]: name,
      [SCREEN_PROPERTIES.PATH]: path,
      [SCREEN_PROPERTIES.SOURCE]: mapped.source,
      [SCREEN_PROPERTIES.PREVIOUS_NAME]: previous?.name ?? null,
      [SCREEN_PROPERTIES.PREVIOUS_PATH]: previous?.path ?? null,
      [SCREEN_PROPERTIES.PREVIOUS_DURATION_MS]: previous ? arrivedAt - previous.arrivedAt : null,
    };
    if (P.isString(mapped.title)) {
      properties[SCREEN_PROPERTIES.TITLE] = mapped.title;
    }
    if (options.includeParams && mapped.params !== undefined) {
      properties[SCREEN_PROPERTIES.PARAMS] = coerceParams(mapped.params);
    }

    state = Option.some({ identity: mapped.identity, name, path, arrivedAt });
    return Option.some(properties);
  };

  return {
    transition,
    reset: () => {
      state = Option.none();
    },
  };
}
