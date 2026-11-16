import React from "react";
import * as Option from "effect/Option";

import type { VoidhashClient } from "../../client";
import type { Person } from "../../core/entities/person";
import {
  currentPersonAtom,
  currentPersonFreshnessAtom,
  identityEpochAtom,
} from "../../core/reactivity/client-state";
import type { VoidhashError } from "../../errors";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export interface UseCurrentPersonResult {
  /** The person, or `null` until the first snapshot loads and while the client is disabled. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  readonly data: Person | null;
  /** The error that stopped the last read, or `null`. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  readonly error: VoidhashError | null;
  /** `true` while the provider initializes and until this hook's first read has answered. */
  readonly isLoading: boolean;
  /**
   * `true` while the person comes from a snapshot the server has not
   * confirmed recently: a cached one past its refresh window or TTL, or none
   * at all yet. Clears as soon as a refresh lands.
   */
  readonly isStale: boolean;
  readonly refetch: () => Promise<void>;
}

export function currentPersonHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
  /** The hook's name in the error a development build throws outside a provider. */
  hookName = "useCurrentPerson",
) {
  /**
   * Reads the current person snapshot. Re-renders when a refresh lands and
   * reads again after `identify()` or `reset()` switches the person.
   */
  function useCurrentPerson(): UseCurrentPersonResult {
    const status = useProviderStatus(vhContext, hookName);
    const registry = client.internal.getAtomRegistry();
    const identityEpoch = useAtomValue(registry, identityEpochAtom);

    const getPersonCallback = React.useCallback(
      () => client.getCurrentPerson(),
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- identityEpoch is the refetch trigger, not an input of the call.
      [identityEpoch],
    );

    const { isLoading, error, refetch } = useAsyncFunction(getPersonCallback, status);

    const person = useAtomValue(registry, currentPersonAtom);
    const freshness = useAtomValue(registry, currentPersonFreshnessAtom);

    return {
      data: Option.getOrNull(person),
      error,
      isLoading,
      // Staleness travels with the published snapshot, so a refresh that
      // lands in the background clears it.
      isStale: !isLoading && (freshness.isStale || freshness.isExpired),
      refetch,
    };
  }
  return useCurrentPerson;
}
