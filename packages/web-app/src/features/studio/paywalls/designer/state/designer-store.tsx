"use client";

import { createClientDocument, TransportError, WebSocketTransport } from "@voidhash/mimic/client";
import { mimic } from "@voidhash/mimic/zustand";
import { useCommander } from "@voidhash/mimic/zustand-commander";
import {
  PaywallDesignerDocument,
  PresenceSchema,
  type PresenceInput,
} from "@voidhash/mimic-schema";
import { Effect } from "effect";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { create } from "zustand";

import { managedRuntime, VoidhashRpc } from "@/features/studio/lib/effect-query";

import { SHOW_GRID } from "../constants";
import {
  clampAiPanelWidth,
  clampLeftPanelWidth,
  clampRightPanelWidth,
  PANEL_DIMENSIONS,
} from "../panels/constants";
import { loadPanelWidths } from "../panels/panel-width-storage";
import { commander } from "./designer-commander";
import type {
  AgentCanvasOperation,
  CodeComponentsState,
  ComponentCatalog,
  ComponentPreviewStateSelection,
  DesignerMode,
  DevModeTab,
} from "./designer-store-state";

const initialComponentCatalog: ComponentCatalog = {
  byContentHash: {},
  components: {},
};

const initialComponentPreviewStateSelection: ComponentPreviewStateSelection = {};

const initialCodeComponents: CodeComponentsState = {
  compiled: {},
  previewState: null,
  activeTabPath: null,
  openTabs: [],
  dirty: {},
};

// ============================================================================
// Edit token + document
// ============================================================================

/**
 * Mints a fresh single-use edit token for the paywall document. Called once
 * on mount for the document `url` and again by the transport's token callback
 * on every (re)connect — tokens are single-use, so they are never reused.
 */
function requestPaywallEditToken(paywallId: string) {
  return managedRuntime.runPromise(
    VoidhashRpc.use((rpc) => rpc.RequestPaywallEditToken({ paywallId })),
  );
}

/**
 * Creates the client document for a paywall, connecting to the mimic host at
 * the given document URL. The transport re-mints a token per (re)connect.
 * `onAuthFailure` fires on every in-band auth failure — initial connect AND
 * reconnects — which terminally stops the transport's reconnect loop.
 */
export function createPaywallDesignerDocument(options: {
  paywallId: string;
  url: string;
  initialPresence: PresenceInput;
  onAuthFailure?: (error: Error) => void;
}) {
  return createClientDocument({
    presence: {
      initial: options.initialPresence,
      primitive: PresenceSchema,
    },
    primitive: PaywallDesignerDocument,
    transport: new WebSocketTransport({
      onAuthFailure: options.onAuthFailure,
      reconnectDelayMs: 5000,
      token: async () => (await requestPaywallEditToken(options.paywallId)).token,
      url: options.url,
    }),
  });
}

/** The designer's client document instance type. */
export type PaywallDesignerDocumentInstance = ReturnType<typeof createPaywallDesignerDocument>;

// ============================================================================
// Store Factory
// ============================================================================

/**
 * Builds the designer store's local (browser-only) state slice — everything the
 * mimic/commander middleware does NOT own. Extracted so the live store factory
 * and headless test harnesses build the exact same initial local state (the
 * panel-definition test harness reuses it via {@link createDesignerStore}).
 */
function createDesignerLocalState() {
  const storedWidths = loadPanelWidths();
  return {
    // Local browser state
    canvas: {
      boundingBoxes: {},
      scale: 1,
      x: 0,
      y: 0,
    },
    debug: {
      showGrid: SHOW_GRID,
    },
    dragSelect: {
      currentPoint: null,
      isActive: false,
      previewSelectedNodeIds: [],
      startPoint: null,
    },
    resize: {
      currentNodeDimensions: {},
      handle: null,
      initialCombinedBounds: null,
      initialNodeDimensions: {},
      originalStateOverrideStyles: {},
      originalDocumentState: {},
      stateOverrideTargets: {},
      isActive: false,
      startScreenPoint: null,
    },
    move: {
      isActive: false,
      startScreenPoint: null,
      nodes: {},
    },
    componentCatalog: initialComponentCatalog,
    componentPreviewStateSelection: initialComponentPreviewStateSelection,
    codeComponents: initialCodeComponents,
    highlightedNodeId: null,
    mode: "design" as DesignerMode,
    previewScale: 1,
    stateOverrideSelection: {},
    activeLocale: null,
    textEditingNodeId: null,
    tools: {
      activeTool: "cursor",
    },
    viewport: {
      panels: {
        bottom: { height: 0 },
        left: { width: clampLeftPanelWidth(storedWidths.left ?? PANEL_DIMENSIONS.LEFT_WIDTH) },
        right: { width: clampRightPanelWidth(storedWidths.right ?? PANEL_DIMENSIONS.RIGHT_WIDTH) },
        top: { height: 0 },
      },
      panelResizeActive: false,
    },
    devMode: {
      enabled: false,
      activeTab: "snapshot" as DevModeTab,
    },
    ai: {
      operations: {} as Record<string, AgentCanvasOperation>,
      localIsWorking: false,
      panelOpen: true,
      width: clampAiPanelWidth(storedWidths.ai ?? PANEL_DIMENSIONS.AI_CHAT_WIDTH),
    },
  };
}

/**
 * Creates the designer zustand store over a mimic client `document`, wiring the
 * mimic + commander middleware and seeding the browser-only local state. The
 * document may be the live WebSocket-backed instance (production) or an offline
 * stub (tests) — construction is identical; only `autoConnect` is disabled so
 * the caller owns connect().
 */
export function createDesignerStore(document: PaywallDesignerDocumentInstance) {
  // The provider owns connect() so terminal auth failures surface as an
  // error state — the middleware's autoConnect would swallow the rejection.
  return create(
    commander.middleware(mimic(document, createDesignerLocalState, { autoConnect: false })),
  );
}

/** @deprecated Internal alias retained for the provider; use {@link createDesignerStore}. */
const createPaywallDesignerStore = createDesignerStore;

export type PaywallDesignerStoreType = ReturnType<typeof createPaywallDesignerStore>;

/** The commander dispatch returned by {@link usePaywallDesignerActions}. */
export type PaywallDesignerDispatch = ReturnType<typeof usePaywallDesignerActions>;

// ============================================================================
// Store boundary selectors
// ============================================================================

export {
  documentRootFromSnapshot,
  selectDocumentRoot,
  selectRenderRoot,
} from "./utils/document-root";

// ============================================================================
// React Context
// ============================================================================

/**
 * The React context that carries the designer's zustand store instance. Exported
 * so a separate React reconciler root (e.g. the panel-runtime reconciler that
 * renders built-in panel definitions) can re-provide the SAME store instance
 * around its subtree — `usePaywallDesignerStore()` reads from this context, so
 * re-providing it makes every `useStore(store, …)`-based section hook work
 * inside the reconciler root exactly as it does in the main tree.
 */
export const PaywallStoreContext = createContext<PaywallDesignerStoreType | null>(null);

interface PaywallDesignerStoreProviderProps {
  paywallId: string;
  children: React.ReactNode;
  /** Rendered while the edit token is being minted (no store exists yet). */
  renderLoading: () => React.ReactNode;
  /** Rendered on terminal transport/token failure, with a retry that re-creates the store. */
  renderError: (error: Error, retry: () => void) => React.ReactNode;
}

type ProviderPhase =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; store: PaywallDesignerStoreType };

/**
 * Terminal transport failures permanently stop the reconnect loop — today
 * that is exactly the in-band `auth_result` failure surfaced by the transport
 * as a `TransportError` with this message prefix. Every other `connect()`
 * rejection (host unreachable, token RPC failure) leaves the transport's
 * reconnect loop running, so the provider stays in the loading phase.
 */
function isTerminalTransportError(error: unknown): boolean {
  return (
    error instanceof TransportError && error.message.startsWith("WebSocket authentication failed")
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createInitialPresence(): PresenceInput {
  return {
    participant: { kind: "human" },
    selectedNodeIds: [],
    user: {
      color: `#${Math.floor(Math.random() * 16_777_215)
        .toString(16)
        .padStart(6, "0")}`,
      name: `User ${Math.floor(Math.random() * 1000)}`,
    },
  };
}

export function PaywallDesignerStoreProvider({
  paywallId,
  children,
  renderLoading,
  renderError,
}: PaywallDesignerStoreProviderProps) {
  const [phase, setPhase] = useState<ProviderPhase>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const initialPresenceRef = useRef<PresenceInput | null>(null);
  initialPresenceRef.current ??= createInitialPresence();

  const retry = useCallback(() => {
    setPhase({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let document: PaywallDesignerDocumentInstance | null = null;

    setPhase({ status: "loading" });

    void (async () => {
      const { url } = await requestPaywallEditToken(paywallId);
      if (cancelled) {
        return;
      }

      document = createPaywallDesignerDocument({
        initialPresence: initialPresenceRef.current ?? createInitialPresence(),
        // Auth failures are terminal (the transport stops reconnecting)
        // and can fire at ANY reconnect, long after connect() resolved —
        // flip to the error phase whenever they happen so the editor never
        // keeps queueing edits against a dead transport.
        onAuthFailure: (error) => {
          if (cancelled) {
            return;
          }
          document?.disconnect();
          setPhase({ status: "error", error });
        },
        paywallId,
        url,
      });
      const store = createPaywallDesignerStore(document);
      setPhase({ status: "ready", store });

      document.connect().catch((error: unknown) => {
        if (cancelled || !isTerminalTransportError(error)) {
          return;
        }
        document?.disconnect();
        setPhase({ status: "error", error: toError(error) });
      });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setPhase({ status: "error", error: toError(error) });
      }
    });

    return () => {
      cancelled = true;
      document?.disconnect();
    };
  }, [paywallId, attempt]);

  if (phase.status === "loading") {
    return <>{renderLoading()}</>;
  }
  if (phase.status === "error") {
    return <>{renderError(phase.error, retry)}</>;
  }
  return (
    <PaywallStoreContext.Provider value={phase.store}>{children}</PaywallStoreContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function usePaywallDesignerStore() {
  const store = useContext(PaywallStoreContext);
  if (!store) {
    return Effect.runSync(Effect.die(new Error("Missing DesignerStoreProvider")));
  }
  return store;
}

/**
 * Get a dispatch function to call store commands.
 * Returns a fully type-safe dispatch function using the Commander pattern.
 *
 * @example
 * const dispatch = usePaywallDesignerActions();
 * dispatch(setActiveTool)({ tool: 'cursor' });
 * dispatch(updateScreenNode)({ id: '123', paddingTop: 10 });
 */
export function usePaywallDesignerActions() {
  const store = usePaywallDesignerStore();
  return useCommander(store);
}
