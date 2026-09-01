import React from "react";
import * as Option from "effect/Option";

import type { VoidhashClient } from "../../client";
import { currentPersonAtom } from "../../core/reactivity/client-state";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export function currentPersonHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  function useCurrentPerson() {
    const voidhashContext = React.useContext(vhContext).valueOrUndefined;

    const getPersonCallback = React.useCallback(() => client.getCurrentPerson(), []);

    const { isLoading, error, refetch } = useAsyncFunction(getPersonCallback, {
      enabled: voidhashContext?.isInitialized,
    });

    const person = useAtomValue(client.internal.getAtomRegistry(), currentPersonAtom);

    return {
      /** `null` until the first snapshot loads or while the client is disabled. */
      data: Option.getOrNull(person),
      error,
      isLoading,
      refetch,
    };
  }
  return useCurrentPerson;
}
