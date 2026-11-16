import React from "react";
import * as Option from "effect/Option";

import type { VoidhashClient } from "../../client";
import { type EntitlementGrant, findActiveGrant } from "../../core/entitlements/find-grant";
import type { VoidhashError } from "../../errors";
import {
  currentPersonAtom,
  currentPersonFreshnessAtom,
  identityEpochAtom,
} from "../../core/reactivity/client-state";
import type { PerkSlug } from "../../core/schema/registry";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export interface UseHasPerkResult {
  /** The active grant behind `hasAccess`, or `null` when there is none. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  grant: EntitlementGrant | null;
  hasAccess: boolean;
  /**
   * `true` while the provider initializes and until this hook's first check
   * has answered, so `hasAccess: false` is never reported before the SDK has
   * looked. `false` for a disabled client.
   */
  isLoading: boolean;
  /**
   * True while `hasAccess` is answered from a snapshot the server has not
   * confirmed recently: a cached one past its refresh window or TTL, or none
   * at all yet. Clears as soon as a refresh lands, even one that runs in the
   * background. Pair with `error` to decide whether to fail open or closed.
   */
  isStale: boolean;
  /** The error that stopped the last check, or `null`. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  error: VoidhashError | null;
  refetch: () => Promise<void>;
}

export function hasPerkHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Checks whether the current person holds an active grant for `perkSlug`,
   * the perk slug configured in Studio. Re-renders when a refresh lands and
   * checks again after `identify()` or `reset()` switches the person.
   */
  function useHasPerk(perkSlug: PerkSlug): UseHasPerkResult {
    const status = useProviderStatus(vhContext, "useHasPerk");
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

    const grant = React.useMemo(() => findActiveGrant(person, perkSlug), [person, perkSlug]);

    // Staleness travels with the published snapshot, not with this hook's
    // own read: a refresh that lands later (in the background, after a
    // purchase or a restore) publishes a fresh snapshot and clears it.
    // Transport failures never surface as errors (the cached snapshot is
    // served instead), so the error fallback only covers the rare failures
    // that do surface while a cached grant is being served.
    const isStale =
      !isLoading &&
      (freshness.isStale ||
        freshness.isExpired ||
        (error !== null && Option.isSome(person) && Option.isSome(grant)));

    return {
      error,
      grant: Option.getOrNull(grant),
      hasAccess: Option.isSome(grant),
      isLoading,
      isStale,
      refetch,
    };
  }
  return useHasPerk;
}
