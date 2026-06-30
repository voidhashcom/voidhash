import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import { currentPersonAtom } from "../../core/reactivity/client-state";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export function currentPersonHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<VoidhashContext | null>,
) {
  function useCurrentPerson() {
    const voidhashContext = React.useContext(vhContext);

    const getPersonCallback = useCallback(() => client.getCurrentPerson(), []);

    const { isLoading, error, refetch } = useAsyncFunction(getPersonCallback, {
      enabled: voidhashContext?.isInitialized,
    });

    const person = useAtomValue(client.internal_getAtomRegistry(), currentPersonAtom);

    // Preserve the previous return shape: `data` spreads the person fields,
    // so callers reading e.g. `data.email` keep working and `null` becomes
    // `{}` rather than `null`.
    const data = useMemo(() => ({ ...person }), [person]);

    return {
      data,
      error,
      isLoading,
      refetch,
    };
  }
  return useCurrentPerson;
}
