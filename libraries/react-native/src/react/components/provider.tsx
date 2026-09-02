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

/**
 * Shared across every client's provider so integrations shipped as separate
 * subpaths (`./expo-router`, `./react-navigation`) can reach the client that
 * is mounted above them without knowing which `createVoidhashClient` result
 * produced it.
 */
const ActiveVoidhashClientContext = createContext<Option.Option<VoidhashClient>>(Option.none());

/**
 * Returns the client of the nearest `VoidhashProvider`.
 * @internal
 */
export function useVoidhashClient(): VoidhashClient {
  const client = React.useContext(ActiveVoidhashClientContext);
  if (Option.isNone(client)) {
    throw new TypeError("useVoidhashClient must be used within a VoidhashProvider");
  }
  return client.value;
}

export function voidhashProviderFactory(initialClient: VoidhashClient) {
  const VoidhashContext = createContext<Option.Option<VoidhashContext>>(Option.none());
  const lifecycle = createVoidhashClientLifecycle(initialClient);
  const activeClient = Option.some(initialClient);

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

    return (
      <ActiveVoidhashClientContext.Provider value={activeClient}>
        <VoidhashContext.Provider value={Option.some(value)}>{children}</VoidhashContext.Provider>
      </ActiveVoidhashClientContext.Provider>
    );
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
