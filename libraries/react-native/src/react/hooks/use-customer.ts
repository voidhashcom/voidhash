import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { VoidhashClient } from '../../client';
import type { VoidhashSchema } from '../../core/schema';
import type { Customer } from '../../core/types';
import type { VoidhashContext } from '../components/provider';
import useAsyncFunction from './use-async-function';

export function currentCustomerHookFactory<TSchema extends VoidhashSchema>(
  client: VoidhashClient<TSchema>,
  vhContext: React.Context<VoidhashContext<TSchema> | null>
) {
  function useCurrentCustomer() {
    const voidhashContext = React.useContext(vhContext);
    const [customer, setCustomer] = useState<Customer | null>(null);

    const setCustomerIfDifferent = useCallback(
      (newCustomer: Customer | null) => {
        if (JSON.stringify(customer) === JSON.stringify(newCustomer)) {
          return;
        }
        setCustomer(newCustomer);
      },
      [customer]
    );

    // Loading customer
    const getCustomerCallback = useCallback(
      () => client.getCurrentCustomer(),
      [client]
    );

    const {
      data: loadedCustomer,
      isLoading,
      error,
      refetch
    } = useAsyncFunction(getCustomerCallback, {
      enabled: voidhashContext?.isInitialized
    });

    // Listen for customer updates. Update state if there was a change. This is used to sync state between uses of this hook and for background updates.
    useEffect(() => {
      const eventBus = client.internal_getEventBus();
      const removeListener = eventBus.on('customer-fetched', (newCustomer) => {
        setCustomerIfDifferent(newCustomer);
      });

      return () => {
        removeListener();
      };
    }, [client, setCustomerIfDifferent]);

    // Processing
    const data = useMemo(() => {
      return {
        ...customer
      };
    }, [customer]);

    setCustomerIfDifferent(loadedCustomer ?? null);

    return {
      data,
      isLoading,
      error,
      refetch
    };
  }
  return useCurrentCustomer;
}
