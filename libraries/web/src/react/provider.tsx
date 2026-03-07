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
  readonly appUserId: string | null;
  readonly client: VoidhashWebClient;
  readonly isInitialized: boolean;
}

export const VoidhashReactContext =
  createContext<VoidhashReactContextValue | null>(null);

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
  const [appUserId, setAppUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const removeInitialized = client.on("initialized", ({ appUserId }) => {
      if (!isMounted) {
        return;
      }
      setIsInitialized(true);
      setAppUserId(appUserId);
    });
    const removeIdentityChanged = client.on("identity-changed", ({ appUserId }) => {
      if (isMounted) {
        setAppUserId(appUserId);
      }
    });

    void client.initialize().then(() => {
      if (isMounted) {
        setIsInitialized(true);
        setAppUserId(client.getAppUserId());
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
      appUserId,
      client,
      isInitialized,
    }),
    [appUserId, client, isInitialized]
  );

  return (
    <VoidhashReactContext.Provider value={value}>
      {props.children}
    </VoidhashReactContext.Provider>
  );
}
