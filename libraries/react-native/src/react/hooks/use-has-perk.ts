import React from "react";
import * as Option from "effect/Option";

import type { VoidhashClient } from "../../client";
import { findActiveGrant } from "../../core/entitlements/find-grant";
import type { VoidhashError } from "../../errors";
import { currentPersonAtom } from "../../core/reactivity/client-state";
import type { PerkSlug } from "../../core/schema/registry";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export interface UseHasPerkResult {
  /** The active grant behind `hasAccess`, or `null` when there is none. */
  grant: ReturnType<typeof findActiveGrant>;
  hasAccess: boolean;
  isLoading: boolean;
  /**
   * True when the refresh failed but `hasAccess` was answered from the cached
   * snapshot. Pair with `error` to decide whether to fail open or closed.
   */
  isStale: boolean;
  error: Option.Option<VoidhashError>;
  refetch: () => Promise<void>;
}

export function hasPerkHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  function useHasPerk(perkSlug: PerkSlug): UseHasPerkResult {
    const voidhashContext = React.useContext(vhContext).valueOrUndefined;

    const getPersonCallback = React.useCallback(() => client.getCurrentPerson(), []);

    const {
      isLoading,
      error: fetchError,
      refetch,
    } = useAsyncFunction(getPersonCallback, {
      enabled: voidhashContext?.isInitialized,
    });
    const error = Option.fromUndefinedOr(fetchError);

    const person = useAtomValue(client.internal.getAtomRegistry(), currentPersonAtom);

    const grant = React.useMemo(() => findActiveGrant(person, perkSlug), [person, perkSlug]);

    // A failed refresh must not be read as "no access": when a cached snapshot
    // exists the answer is served stale instead of denied.
    const isStale =
      !isLoading && Option.isSome(error) && Option.isSome(person) && Option.isSome(grant);

    return {
      error,
      grant,
      hasAccess: Option.isSome(grant),
      isLoading,
      isStale,
      refetch,
    };
  }
  return useHasPerk;
}
