import { Effect } from "effect";
import React, { type ReactNode, createContext } from "react";

import type { VoidhashClient } from "../../client";

export interface VoidhashProviderBaseProps {
  children: ReactNode;
}

export interface VoidhashContext {
  isInitialized: boolean;
  client: VoidhashClient;
}

export function voidhashProviderFactory(initialClient: VoidhashClient) {
  const VoidhashContext = createContext<VoidhashContext | null>(null);
  function VoidhashProvider({ children }: VoidhashProviderBaseProps) {
    const client = React.useRef(initialClient);

    const [isInitialized, setIsInitialized] = React.useState(false);

    React.useEffect(() => {
      void client.current.init().then(() => {
        setIsInitialized(true);
      });
    }, []);

    return (
      <VoidhashContext.Provider
        value={{
          client: client.current,
          isInitialized,
        }}
      >
        {children}
      </VoidhashContext.Provider>
    );
  }

  function useVoidhash() {
    const context = React.useContext(VoidhashContext);
    if (!context) {
      return Effect.runSync(
        Effect.die(new Error("useVoidhash must be used within a VoidhashProvider")),
      );
    }
    return context;
  }

  return { context: VoidhashContext, provider: VoidhashProvider, useVoidhash };
}
