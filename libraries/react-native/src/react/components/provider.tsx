import * as Option from "effect/Option";
import React, { type ReactNode, createContext } from "react";

import type { VoidhashClient } from "../../client";
import {
  type VoidhashInitError,
  type VoidhashInitStatus,
  createVoidhashClientLifecycle,
} from "../internal/client-lifecycle";

export type { VoidhashInitError, VoidhashInitStatus };

export interface VoidhashProviderBaseProps {
  children: ReactNode;
}

export interface VoidhashContext {
  client: VoidhashClient;
  /** The error that failed `init()`. `null` unless `status` is `"failed"`. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  initError: VoidhashInitError | null;
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

/**
 * The status of the provider above the calling hook, `None` outside one.
 * Outside a provider a development build throws, so a missing provider shows
 * at once instead of as a screen that never loads; a release build leaves the
 * hook inert.
 * @internal
 */
export function useProviderStatus(
  context: React.Context<Option.Option<VoidhashContext>>,
  hookName: string,
): Option.Option<VoidhashInitStatus> {
  const provided = React.useContext(context);
  if (Option.isNone(provided) && __DEV__) {
    throw new TypeError(`${hookName} must be used within a VoidhashProvider`);
  }
  return Option.map(provided, (value) => value.status);
}

/**
 * Builds the provider, context and `useVoidhash` hook of one client. Every
 * provider instance shares the client's lifecycle, so an app with several
 * React roots can mount one provider per root: the client initializes with
 * the first and ends with the last.
 */
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
        initError: Option.getOrNull(state.initError),
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
