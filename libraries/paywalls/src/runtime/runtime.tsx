import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createDefaultBridge, type PaywallBridge } from "./bridge";
import {
  type PaywallDimensions,
  type PaywallDimensionTarget,
  type PaywallPlatform,
  type PaywallProduct,
  type PaywallRuntimeConfig,
  type PaywallSafeAreaInsets,
  type PaywallVariables,
  readInjectedConfig,
} from "./config";
import {
  type ResolvedPaywallEnvironment,
  resolvePaywallEnvironment,
  useBrowserEnvironment,
} from "./environment";
import {
  createCloseEnvelope,
  createEventEnvelope,
  createOpenExternalEnvelope,
  createPurchaseEnvelope,
  createReadyEnvelope,
  createRestoreEnvelope,
  type PaywallBridgeError,
  type PaywallInboundEnvelope,
  type PaywallTransactionStatus,
} from "./envelope";

/** Actions a paywall can request from its host. */
export interface PaywallActions {
  /** Start a purchase. Defaults to the currently selected product. */
  readonly purchase: (productId?: string) => void;
  /** Restore previously purchased entitlements. */
  readonly restore: () => void;
  /** Dismiss the paywall. */
  readonly close: (reason?: string) => void;
  /** Open an external URL (terms, privacy, …). */
  readonly openUrl: (url: string) => void;
  /** Emit a custom analytics event. */
  readonly track: (name: string, properties?: Record<string, unknown>) => void;
  /** Change the highlighted product. */
  readonly selectProduct: (productId: string) => void;
}

/** The current transaction state plus the last error/product it relates to. */
export interface PaywallStatusSnapshot {
  readonly status: PaywallTransactionStatus;
  readonly productId?: string;
  readonly error?: PaywallBridgeError;
}

interface PaywallRuntimeValue {
  readonly config: PaywallRuntimeConfig;
  readonly environment: ResolvedPaywallEnvironment;
  readonly products: ReadonlyArray<PaywallProduct>;
  readonly variables: PaywallVariables;
  readonly selectedProductId: string | undefined;
  readonly selectedProduct: PaywallProduct | undefined;
  readonly status: PaywallStatusSnapshot;
  readonly actions: PaywallActions;
}

const PaywallRuntimeContext = createContext<PaywallRuntimeValue | null>(null);

const useRuntimeOrThrow = (hook: string): PaywallRuntimeValue => {
  const value = useContext(PaywallRuntimeContext);
  if (!value) {
    throw new Error(`${hook} must be used inside a paywall rendered by @voidhash/paywalls.`);
  }
  return value;
};

let requestCounter = 0;
const nextRequestId = (): string => `vh-${Date.now().toString(36)}-${++requestCounter}`;

const IDLE_STATUS: PaywallStatusSnapshot = { status: "idle" };

const deriveStatusFromResponse = (
  envelope: Extract<PaywallInboundEnvelope, { type: "response" }>,
): PaywallStatusSnapshot | null => {
  const { action, status, data, error } = envelope.payload;
  if (action !== "purchase" && action !== "restore") {
    return null;
  }
  if (status === "error") {
    return { status: "failed", error };
  }
  return {
    status: action === "purchase" ? "purchased" : "restored",
    productId: typeof data?.productId === "string" ? data.productId : undefined,
  };
};

export interface PaywallRuntimeProviderProps {
  /**
   * Runtime products/variables. Defaults to the host-injected
   * `window.__VOIDHASH_PAYWALL__` (or an empty config), per contract §7.1.
   */
  config?: PaywallRuntimeConfig;
  /** Override the bridge (Studio injects its own; tests inject mocks). */
  bridge?: PaywallBridge;
  children: ReactNode;
}

/**
 * Supplies products, author variables and host-backed actions to a paywall
 * subtree, and wires the bridge: it announces readiness on mount, applies late
 * `configure` messages (contract §7 — render immediately with the
 * injected-or-empty config, reconfigure when the host catches up), and tracks
 * purchase/restore progress from host responses and status pushes.
 */
export const PaywallRuntimeProvider = ({
  config: configProp,
  bridge,
  children,
}: PaywallRuntimeProviderProps): ReactNode => {
  const resolvedBridge = useMemo(() => bridge ?? createDefaultBridge(), [bridge]);

  const [config, setConfig] = useState<PaywallRuntimeConfig>(
    () => configProp ?? readInjectedConfig(),
  );
  useEffect(() => {
    if (configProp) {
      setConfig(configProp);
    }
  }, [configProp]);

  const browserEnvironment = useBrowserEnvironment(
    config.safeAreaInsets === undefined || config.dimensions === undefined,
  );
  const environment = useMemo(
    () => resolvePaywallEnvironment(config, browserEnvironment),
    [config, browserEnvironment],
  );

  const [explicitSelection, setExplicitSelection] = useState<string | undefined>(undefined);
  // An explicit user selection survives reconfiguration as long as the product
  // still exists; otherwise fall back to the configured default.
  const selectedProductId = useMemo(() => {
    if (
      explicitSelection !== undefined &&
      config.products.some((product) => product.id === explicitSelection)
    ) {
      return explicitSelection;
    }
    return config.defaultSelectedProductId ?? config.products[0]?.id;
  }, [explicitSelection, config]);

  const [status, setStatus] = useState<PaywallStatusSnapshot>(IDLE_STATUS);

  // Guards against duplicate `ready` announcements (React StrictMode's
  // double-invoked mount effect in development).
  const announcedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = resolvedBridge.subscribe((envelope) => {
      if (envelope.type === "configure") {
        setConfig(envelope.payload);
        return;
      }
      if (envelope.type === "status") {
        const { status: nextStatus, productId, error } = envelope.payload;
        setStatus({
          status: nextStatus,
          productId,
          error: error === undefined ? undefined : { code: "HOST_STATUS", message: error },
        });
        return;
      }
      const derived = deriveStatusFromResponse(envelope);
      if (derived) {
        setStatus(derived);
      }
    });

    if (!announcedRef.current) {
      announcedRef.current = true;
      resolvedBridge.post(createReadyEnvelope());
    }

    return unsubscribe;
  }, [resolvedBridge]);

  const actions = useMemo<PaywallActions>(
    () => ({
      purchase: (productId) => {
        const target = productId ?? selectedProductId;
        if (!target) {
          // dev-visible signal — a purchase that silently no-ops is undebuggable from inside a WebView.
          console.warn(
            "[voidhash-paywall] purchase() called with no selected or available product — did the host send a configure message with products?",
          );
          return;
        }
        setStatus({ status: "purchasing", productId: target });
        resolvedBridge.post(createPurchaseEnvelope(target, nextRequestId()));
      },
      restore: () => {
        setStatus({ status: "restoring" });
        resolvedBridge.post(createRestoreEnvelope(nextRequestId()));
      },
      close: (reason) => resolvedBridge.post(createCloseEnvelope(reason)),
      openUrl: (url) => resolvedBridge.post(createOpenExternalEnvelope(url)),
      track: (name, properties) => resolvedBridge.post(createEventEnvelope(name, properties)),
      selectProduct: (productId) => setExplicitSelection(productId),
    }),
    [resolvedBridge, selectedProductId],
  );

  const value = useMemo<PaywallRuntimeValue>(
    () => ({
      actions,
      config,
      environment,
      products: config.products,
      selectedProduct: config.products.find((product) => product.id === selectedProductId),
      selectedProductId,
      status,
      variables: config.variables,
    }),
    [actions, config, environment, selectedProductId, status],
  );

  return <PaywallRuntimeContext.Provider value={value}>{children}</PaywallRuntimeContext.Provider>;
};

/** The products available on this paywall. */
export const usePaywallProducts = (): ReadonlyArray<PaywallProduct> =>
  useRuntimeOrThrow("usePaywallProducts").products;

/** Author-configurable variables (dashboard/experiment overrides). */
export const usePaywallVariables = (): PaywallVariables =>
  useRuntimeOrThrow("usePaywallVariables").variables;

/** The current runtime platform. Defaults to `web` when the host does not supply one. */
export const usePlatform = (): PaywallPlatform =>
  useRuntimeOrThrow("usePlatform").environment.platform;

/** Safe-area insets in logical/CSS pixels. */
export const useSafeAreaInsets = (): PaywallSafeAreaInsets =>
  useRuntimeOrThrow("useSafeAreaInsets").environment.safeAreaInsets;

/** Screen or window dimensions in logical/CSS pixels. */
export const useDimensions = (target: PaywallDimensionTarget): PaywallDimensions => {
  const runtime = useRuntimeOrThrow("useDimensions");
  if (target !== "screen" && target !== "window") {
    throw new Error(
      `useDimensions expected "screen" or "window", received ${JSON.stringify(target)}.`,
    );
  }
  return runtime.environment.dimensions[target];
};

/** Host-backed actions: purchase, restore, close, openUrl, track, select. */
export const usePaywallActions = (): PaywallActions =>
  useRuntimeOrThrow("usePaywallActions").actions;

/** The full runtime config supplied by the host or preview environment. */
export const usePaywallConfig = (): PaywallRuntimeConfig =>
  useRuntimeOrThrow("usePaywallConfig").config;

/** The currently highlighted product and a setter. */
export const useSelectedProduct = (): {
  selectedProduct: PaywallProduct | undefined;
  selectedProductId: string | undefined;
  selectProduct: (productId: string) => void;
} => {
  const runtime = useRuntimeOrThrow("useSelectedProduct");
  return {
    selectProduct: runtime.actions.selectProduct,
    selectedProduct: runtime.selectedProduct,
    selectedProductId: runtime.selectedProductId,
  };
};

/** The current transaction status (idle/purchasing/purchased/…). */
export const usePaywallStatus = (): PaywallStatusSnapshot =>
  useRuntimeOrThrow("usePaywallStatus").status;
