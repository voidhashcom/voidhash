import { createContext, useContext, useMemo } from "react";
import { MimicSDK } from "@voidhash/mimic-server";
import { Effect } from "effect";

import type { Credentials } from "@/lib/auth";

const SdkContext = createContext<MimicSDK | null>(null);

/**
 * Builds a single `MimicSDK` instance per (serverUrl, username, password)
 * tuple. The instance lives for the lifetime of the page — we deliberately
 * do NOT call `sdk.dispose()` from a `useEffect` cleanup. React StrictMode
 * runs cleanup-then-setup once on mount in dev to surface lifecycle bugs;
 * disposing the runtime there closes the scope while `useMemo` still holds
 * the same SDK reference, which would abort any in-flight RPC requests
 * (visible as HTTP 499 / "All fibers interrupted" on the server).
 *
 * The runtime backs an HTTP `RpcClient.Protocol` (fetch-based, no persistent
 * connections), so there's nothing urgent to clean up — the browser tears
 * down on navigation/unload anyway.
 */
export function MimicSdkProvider({
  credentials,
  children,
}: {
  credentials: Credentials;
  children: React.ReactNode;
}) {
  const sdk = useMemo(
    () =>
      new MimicSDK({
        url: credentials.serverUrl,
        username: credentials.username,
        password: credentials.password,
      }),
    [credentials.serverUrl, credentials.username, credentials.password],
  );

  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export function useMimicSdk(): MimicSDK {
  const sdk = useContext(SdkContext);
  if (!sdk) {
    // Missing provider is a programmer error, not a recoverable failure:
    // `runSync` on a defect rethrows the Error verbatim to the React tree.
    return Effect.runSync(
      Effect.die(new Error("useMimicSdk must be used within a MimicSdkProvider")),
    );
  }
  return sdk;
}
