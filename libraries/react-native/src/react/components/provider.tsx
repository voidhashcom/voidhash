import * as Option from "effect/Option";
import React, { type ReactNode, createContext } from "react";

import type { VoidhashClient } from "../../client";
import {
  type VoidhashInitStatus,
  type VoidhashClientLifecycleState,
  createVoidhashClientLifecycle,
} from "../internal/client-lifecycle";

export type { VoidhashInitStatus };

export interface VoidhashProviderBaseProps {
  children: ReactNode;
}

export interface VoidhashContext {
  client: VoidhashClient;
  /** The error that failed `init()`. `null` unless `status` is `"failed"`. */
  initError: VoidhashClientLifecycleState["initError"];
  /** Compatibility alias for `status === "ready"`. Stays false while disabled. */
  isInitialized: boolean;
  /**
   * Re-runs `init()` after a failure. No-op while initializing, ready or
   * disabled.
   */
  retryInit: () => void;
  /** `"disabled"` when the client was created with `enabled: false`. */
  status: VoidhashInitStatus;
}

export function voidhashProviderFactory(initialClient: VoidhashClient) {
  const VoidhashContext = createContext<Option.Option<VoidhashContext>>(Option.none());
  const lifecycle = createVoidhashClientLifecycle(initialClient);

  function VoidhashProvider({ children }: VoidhashProviderBaseProps) {
    const state = React.useSyncExternalStore(
      lifecycle.subscribe,
      lifecycle.getState,
      lifecycle.getState,
    );

    React.useEffect(() => lifecycle.mount(), []);

    const value = React.useMemo<VoidhashContext>(
      () => ({
        client: initialClient,
        initError: state.initError,
        isInitialized: state.status === "ready",
        retryInit: lifecycle.retryInit,
        status: state.status,
      }),
      [state.initError, state.status],
    );

    return <VoidhashContext.Provider value={Option.some(value)}>{children}</VoidhashContext.Provider>;
  }

  function useVoidhash() {
    const context = React.useContext(VoidhashContext);
    if (Option.isNone(context)) {
      throw new TypeError("useVoidhash must be used within a VoidhashProvider");
    }
    return context.value;
  }

  return { context: VoidhashContext, provider: VoidhashProvider, useVoidhash };
}
