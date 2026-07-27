import React, { createContext, useEffect, useMemo, useRef, useState } from "react";

import {
  createVoidhashClient,
  type VoidhashClientOptions,
  type VoidhashWebClient,
} from "../client";

interface ProviderBaseProps {
  readonly children: React.ReactNode;
}

interface ProviderWithClient extends ProviderBaseProps {
  readonly client: VoidhashWebClient;
  readonly config?: never;
}

interface ProviderWithConfig extends ProviderBaseProps {
  readonly client?: never;
  readonly config: VoidhashClientOptions;
}

export interface VoidhashReactContextValue {
  readonly client: VoidhashWebClient;
  readonly distinctId: string | null;
  readonly isInitialized: boolean;
}

export const VoidhashReactContext = createContext<VoidhashReactContextValue | null>(null);

export function VoidhashProvider(props: ProviderWithClient | ProviderWithConfig) {
  const clientRef = useRef<VoidhashWebClient | null>(null);
  if (!clientRef.current) {
    clientRef.current =
      "client" in props && props.client
        ? props.client
        : createVoidhashClient((props as ProviderWithConfig).config);
  }

  const client = clientRef.current;
  if (!client) {
    throw new Error("VoidhashProvider failed to create a client instance.");
  }
  const [isInitialized, setIsInitialized] = useState(false);
  const [distinctId, setDistinctId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const removeInitialized = client.on("initialized", ({ distinctId }) => {
      if (!isMounted) {
        return;
      }
      setIsInitialized(true);
      setDistinctId(distinctId);
    });
    const removeIdentityChanged = client.on("identity-changed", ({ distinctId }) => {
      if (isMounted) {
        setDistinctId(distinctId);
      }
    });

    void client.initialize().then(() => {
      if (isMounted) {
        setIsInitialized(true);
        setDistinctId(client.getDistinctId());
      }
    });

    return () => {
      isMounted = false;
      removeInitialized();
      removeIdentityChanged();
      void client.destroy();
    };
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      distinctId,
      isInitialized,
    }),
    [client, distinctId, isInitialized],
  );

  return (
    <VoidhashReactContext.Provider value={value}>{props.children}</VoidhashReactContext.Provider>
  );
}
