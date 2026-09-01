import {
  type ActionCallbacks,
  type PaywallMessage,
  type SnapshotNode,
  type VariableReader,
  type VariableScopes,
  VariableMap,
  VariableStore,
  type VariableValue,
  collectVariableScopes,
  createChainVariableReader,
  findDeclaringNodeInChain,
} from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";
import { createContext, createElement } from "preact";
import { useSyncExternalStore as useAtomSubscription } from "preact/compat";
import { useContext, useRef as useAtomRef } from "preact/hooks";

import type { ComponentArtifacts } from "../component-artifacts";
import * as Console from "effect/Console";
import * as EffectRuntime from "effect/Effect";
import * as Option from "effect/Option";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);


interface PaywallContextValue {
  getNodeVariables: (nodeId: string) => VariableReader;
  setNodeVariable: (nodeId: string, variableId: string, newValue: VariableValue) => void;
  callbacks: ActionCallbacks;
  componentArtifacts?: ComponentArtifacts;
  /** Active locale (undefined → base/default). Consumed by localized renderers. */
  locale?: string;
  /** The document's default locale, derived from the root snapshot. */
  defaultLocale: string;
}

const EMPTY_STORE = new VariableStore();
const atomRegistry = AtomRegistry.make();

function useAtomValue<A>(atom: Atom.Atom<A>): A {
  return useAtomSubscription(
    (notify) => {
      const unmount = atomRegistry.mount(atom);
      const unsubscribe = atomRegistry.subscribe(atom, notify);
      return () => {
        unsubscribe();
        unmount();
      };
    },
    () => atomRegistry.get(atom),
  );
}

const PaywallContext = createContext<PaywallContextValue>({
  callbacks: { onClosePaywall: () => {}, onPurchaseProduct: () => {}, onSetVariable: () => {} },
  defaultLocale: "en",
  getNodeVariables: () => EMPTY_STORE,
  setNodeVariable: () => {},
});

interface PaywallProviderProps {
  snapshot: SnapshotNode;
  componentArtifacts?: ComponentArtifacts;
  /** Active locale (undefined → base/default locale). */
  locale?: string;
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
  const data = effectEncodeJson(message);
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
  const scopes: VariableScopes = collectVariableScopes(snapshot);

  // The Paywall snapshot is the document root; its localization config carries
  // the default locale. Non-root snapshots and pre-localization payloads (which
  // omit the config) fall back to "en".
  const defaultLocale =
    (snapshot.type === "root" ? snapshot.data.localization?.defaultLocale : undefined) ?? "en";

  const storesAtom = useAtomRef(
    Atom.make<Option.Option<VariableMap<string, VariableStore>>>(
      Option.some(new VariableMap(
      [...scopes.stores].map(([nodeId, { store }]): [string, VariableStore] => [nodeId, store]),
      )),
    ),
  ).current;
  const nodeStores = Option.getOrElse(useAtomValue(storesAtom), () => {
    throw new TypeError("Paywall variable-store atom was not initialized");
  });

  // Chain readers are cached per (scopes, nodeStores) generation so consumer
  // memos keyed on the reader identity invalidate exactly when stores change.
  const chainReaders = new VariableMap<string, VariableReader>();

  const getNodeVariables = (nodeId: string): VariableReader => {
      const cached = chainReaders.get(nodeId);
      if (cached) {
        return cached;
      }
      const reader = createChainVariableReader(scopes.parents, (id) => nodeStores.get(id), nodeId);
      chainReaders.set(nodeId, reader);
      return reader;
    };

  const setNodeVariable = (nodeId: string, variableId: string, newValue: VariableValue) => {
      atomRegistry.update(storesAtom, (current) =>
        Option.map(current, (prev) => {
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

        const nextStore = new VariableStore(prevStore);
        nextStore.set(variableId, newValue);

        // Keep the paired ID (entry ID ↔ internal ID) in sync
        const nodeAliases = scopes.stores.get(declaringNodeId)?.aliases;
        const pairedId = nodeAliases?.get(variableId);
        if (pairedId) {
          nextStore.set(pairedId, newValue);
        }

        const next = new VariableMap(prev);
        next.set(declaringNodeId, nextStore);
        return next;
        }),
      );
    };

  const onClosePaywall = () => {
    postPaywallMessage({ type: "paywall:close" });
  };

  const onPurchaseProduct = (productId: string) => {
    postPaywallMessage({ type: "paywall:purchase", productId });
  };

  // onSetVariable in ActionCallbacks doesn't know about nodeId — it's
  // wrapped per-node in use-interactions.ts via scopedCallbacks.
  const onSetVariable = (variableId: string, _newValue: VariableValue) => {
    EffectRuntime.runFork(Console.warn(
      `onSetVariable called directly for "${variableId}" without node context. ` +
        "Use the scoped callback from useInteractions instead.",
    ));
  };

  const callbacks: ActionCallbacks = { onClosePaywall, onPurchaseProduct, onSetVariable };

  const contextValue: PaywallContextValue = {
      getNodeVariables,
      setNodeVariable,
      callbacks,
      componentArtifacts,
      locale,
      defaultLocale,
    };

  return createElement(PaywallContext.Provider, { value: contextValue }, children);
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
