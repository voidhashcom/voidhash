import {
  type ActionCallbacks,
  type PaywallMessage,
  type SnapshotNode,
  type VariableReader,
  type VariableScopes,
  type VariableStore,
  type VariableValue,
  collectVariableScopes,
  createChainVariableReader,
  findDeclaringNodeInChain,
} from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useMemo, useState } from "preact/hooks";

import type { ComponentArtifacts } from "../component-artifacts";

interface PaywallContextValue {
  getNodeVariables: (nodeId: string) => VariableReader;
  setNodeVariable: (nodeId: string, variableId: string, newValue: VariableValue) => void;
  callbacks: ActionCallbacks;
  componentArtifacts: ComponentArtifacts | undefined;
  /** Active locale (undefined → base/default). Consumed by localized renderers. */
  locale: string | undefined;
  /** The document's default locale, derived from the root snapshot. */
  defaultLocale: string;
}

const EMPTY_STORE: VariableStore = new Map();

const PaywallContext = createContext<PaywallContextValue | null>(null);

interface PaywallProviderProps {
  snapshot: SnapshotNode;
  componentArtifacts?: ComponentArtifacts | undefined;
  /** Active locale (undefined → base/default locale). */
  locale?: string | undefined;
  children: ComponentChildren;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

function postPaywallMessage(message: PaywallMessage): void {
  const data = JSON.stringify(message);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(data);
  } else {
    window.parent.postMessage(message, "*");
  }
}

export function PaywallProvider({
  snapshot,
  componentArtifacts,
  locale,
  children,
}: PaywallProviderProps) {
  const scopes = useMemo<VariableScopes>(() => collectVariableScopes(snapshot), [snapshot]);

  // The Paywall snapshot is the document root; its localization config carries
  // the default locale. Non-root snapshots and pre-localization payloads (which
  // omit the config) fall back to "en".
  const defaultLocale =
    (snapshot.type === "root" ? snapshot.data.localization?.defaultLocale : undefined) ?? "en";

  const [nodeStores, setNodeStores] = useState<Map<string, VariableStore>>(() => {
    const stores = new Map<string, VariableStore>();
    for (const [nodeId, { store }] of scopes.stores) {
      stores.set(nodeId, store);
    }
    return stores;
  });

  // Chain readers are cached per (scopes, nodeStores) generation so consumer
  // memos keyed on the reader identity invalidate exactly when stores change.
  const chainReaders = useMemo(() => new Map<string, VariableReader>(), [scopes, nodeStores]);

  const getNodeVariables = useCallback(
    (nodeId: string): VariableReader => {
      const cached = chainReaders.get(nodeId);
      if (cached) {
        return cached;
      }
      const reader = createChainVariableReader(scopes.parents, (id) => nodeStores.get(id), nodeId);
      chainReaders.set(nodeId, reader);
      return reader;
    },
    [chainReaders, nodeStores, scopes],
  );

  const setNodeVariable = useCallback(
    (nodeId: string, variableId: string, newValue: VariableValue) => {
      setNodeStores((prev) => {
        // Write to the nearest store in the ancestor chain declaring the id;
        // drop the write when no scope in the chain declares it.
        const declaringNodeId = findDeclaringNodeInChain(
          scopes.parents,
          (id) => prev.get(id),
          nodeId,
          variableId,
        );
        if (declaringNodeId === undefined) {
          return prev;
        }
        const prevStore = prev.get(declaringNodeId);
        if (!prevStore) {
          return prev;
        }

        const nextStore = new Map(prevStore);
        nextStore.set(variableId, newValue);

        // Keep the paired ID (entry ID ↔ internal ID) in sync
        const nodeAliases = scopes.stores.get(declaringNodeId)?.aliases;
        const pairedId = nodeAliases?.get(variableId);
        if (pairedId) {
          nextStore.set(pairedId, newValue);
        }

        const next = new Map(prev);
        next.set(declaringNodeId, nextStore);
        return next;
      });
    },
    [scopes],
  );

  const onClosePaywall = useCallback(() => {
    postPaywallMessage({ type: "paywall:close" });
  }, []);

  const onPurchaseProduct = useCallback((productId: string) => {
    postPaywallMessage({ type: "paywall:purchase", productId });
  }, []);

  // onSetVariable in ActionCallbacks doesn't know about nodeId — it's
  // wrapped per-node in use-interactions.ts via scopedCallbacks.
  const onSetVariable = useCallback((variableId: string, _newValue: VariableValue) => {
    console.warn(
      `onSetVariable called directly for "${variableId}" without node context. ` +
        "Use the scoped callback from useInteractions instead.",
    );
  }, []);

  const callbacks = useMemo<ActionCallbacks>(
    () => ({ onClosePaywall, onPurchaseProduct, onSetVariable }),
    [onClosePaywall, onPurchaseProduct, onSetVariable],
  );

  const contextValue = useMemo<PaywallContextValue>(
    () => ({
      getNodeVariables,
      setNodeVariable,
      callbacks,
      componentArtifacts,
      locale,
      defaultLocale,
    }),
    [getNodeVariables, setNodeVariable, callbacks, componentArtifacts, locale, defaultLocale],
  );

  return (
    // @ts-ignore Preact Provider type incompatible with React JSX when cross-checked from studio
    <PaywallContext.Provider value={contextValue}>
      {children as unknown as null}
    </PaywallContext.Provider>
  );
}

export function usePaywallContext(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    return {
      getNodeVariables: () => EMPTY_STORE,
      setNodeVariable: () => {},
      callbacks: {
        onClosePaywall: () => {},
        onPurchaseProduct: () => {},
        onSetVariable: () => {},
      },
      componentArtifacts: undefined,
      locale: undefined,
      defaultLocale: "en",
    };
  }
  return ctx;
}
