import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import { currentCustomerAtom } from "../../core/reactivity/client-state";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export function currentCustomerHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<VoidhashContext | null>
) {
  function useCurrentCustomer() {
    const voidhashContext = React.useContext(vhContext);

    const getCustomerCallback = useCallback(
      () => client.getCurrentCustomer(),
      []
    );

    const { isLoading, error, refetch } = useAsyncFunction(getCustomerCallback, {
      enabled: voidhashContext?.isInitialized,
    });

    const customer = useAtomValue(
      client.internal_getAtomRegistry(),
      currentCustomerAtom
    );

    // Preserve the previous return shape: `data` spreads the customer fields,
    // so callers reading e.g. `data.email` keep working and `null` becomes
    // `{}` rather than `null`.
    const data = useMemo(() => ({ ...customer }), [customer]);

    return {
      data,
      error,
      isLoading,
      refetch,
    };
  }
  return useCurrentCustomer;
}
