import * as P from "effect/Predicate";
import React from "react";
import { useGlobalSearchParams, usePathname, useSegments } from "expo-router";

import { useVoidhashClient } from "./react/components/provider";

/**
 * Captures a `$screen` event for every Expo Router pathname the user lands on.
 * Must be called below `voidhash.Provider`, which in an Expo app lives in the
 * root layout and therefore inside the router context.
 *
 * - `$screen_name` is the file route: `"/" + segments.join("/")`, groups kept.
 * - `$screen_path` is the concrete pathname.
 * - Params are added only when the client has `screenTracking.includeParams`.
 */
export function useExpoRouterScreenTracking(): void {
  const client = useVoidhashClient();
  const pathname = usePathname();
  const segments: ReadonlyArray<string> = useSegments();
  const params: Record<string, unknown> = useGlobalSearchParams();
  const name = `/${segments.join("/")}`;

  React.useEffect(() => {
    if (!P.isString(pathname)) {
      return;
    }
    client.trackScreenView({
      identity: pathname,
      name,
      path: pathname,
      params,
      source: "expo-router",
    });
    // Keyed on the pathname only: a params-only update is the same screen
    // instance and must not emit again.
  }, [client, pathname]);
}

/**
 * Drop-in component for the root layout. Renders nothing and runs
 * {@link useExpoRouterScreenTracking}.
 */
export function ScreenTracking(): null {
  useExpoRouterScreenTracking();
  return null;
}
