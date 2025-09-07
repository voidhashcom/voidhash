import React, { createContext, type ReactNode } from 'react';

import type { VoidhashClient } from '../../client';
import type { VoidhashSchema } from '../../core/schema';

type VoidhashProviderBaseProps = {
  children: ReactNode;
};

export type VoidhashContext<TSchema extends VoidhashSchema> = {
  isInitialized: boolean;
  client: VoidhashClient<TSchema>;
};

export function voidhashProviderFactory<TSchema extends VoidhashSchema>(
  initialClient: VoidhashClient<TSchema>
) {
  const VoidhashContext = createContext<VoidhashContext<TSchema> | null>(null);
  function VoidhashProvider({ children }: VoidhashProviderBaseProps) {
    const client = React.useRef(initialClient);

    const [isInitialized, setIsInitialized] = React.useState(false);

    React.useEffect(() => {
      client.current.init().then(() => {
        setIsInitialized(true);
      });
    }, []);

    return (
      <VoidhashContext.Provider
        value={{
          isInitialized,
          client: client.current
        }}
      >
        {children}
      </VoidhashContext.Provider>
    );
  }

  function useVoidhash() {
    const context = React.useContext(VoidhashContext);
    if (!context) {
      throw new Error('useVoidhash must be used within a VoidhashProvider');
    }
    return context;
  }

  return { provider: VoidhashProvider, context: VoidhashContext, useVoidhash };

  // React.useEffect(() => {
  //   const listener = Linking.addEventListener("url", (event) => {
  //     if (
  //       event.url.startsWith(
  //         client.current.internal_getSuccessCallbackBaseUrl()
  //       )
  //     ) {
  //       client.current.internal_onWebCheckoutSuccess(event.url);
  //     } else if (
  //       event.url.startsWith(
  //         client.current.internal_getErrorCallbackBaseUrl()
  //       )
  //     ) {
  //       client.current.internal_onWebCheckoutError(event.url);
  //     }
  //   });
  //   return () => {
  //     listener.remove();
  //   };
  // }, []);
}
