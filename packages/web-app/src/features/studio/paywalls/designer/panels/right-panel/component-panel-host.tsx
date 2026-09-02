"use client";

/**
 * The `componentProps` slot of the right-panel stack. It edits the
 * props of the selected component node(s) either through a HOST-rendered default
 * panel (a {@link PropFieldRow} per manifest prop, wired to the batched
 * multi-node prop actions) or, when the component declares a custom `panel`, a
 * SANDBOXED session whose intent stream the {@link createIntentExecutor} reduces
 * onto the same batched actions.
 *
 * Gating (see {@link ComponentPanelHost}): the slot activates only when EVERY
 * selected node is a component node sharing the SAME identity key
 * (`local:<id>` / `catalog:<hash>`), so a batch edit always targets homogeneous
 * instances; mixed keys render nothing. The custom session mounts only when the
 * component's compiled code is available AND declares a panel; otherwise (and on
 * a custom-session error) the default panel renders.
 */
import type {
  ComponentManifest,
  ComponentPropDefinition,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { Button } from "@voidhash/ui";
import type { ComponentSnapshotNode, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelPropInput, PanelSessionInputs } from "@voidhash/paywalls/panel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand/react";

import { useComponentManifest } from "../../hooks/use-component-manifest";
import { useDesignerDraft } from "../../hooks/use-designer-draft";
import { fetchCatalogPanelCode } from "./catalog-panel-code";
import { PropFieldRow, type PropTargetBinding } from "../../panel-kit/prop-field-row";
import { createIntentExecutor } from "../../panel-runtime/intent-executor";
import { createPanelGestureController } from "../../panel-runtime/gesture-controller";
import { PanelTreeView, type PanelRenderContext } from "../../panel-runtime/host-renderer";
import { createPanelSandboxTransport } from "../../panel-runtime/panel-sandbox-host";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "../../panel-kit/panel-section";
import type { PanelTransport } from "../../panel-runtime/transport";
import {
  removeComponentPropForNodes,
  updateComponentPropBindingForNodes,
} from "../../state/actions/features/component-prop-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type { PaywallDesignerStoreType } from "../../state/designer-store";
import type { CodeComponentsState } from "../../state/designer-store-state";
import { definitionForComponentPath } from "../../state/utils/code-components";
import { collectAncestorVariables, toLabeledVariables } from "../../state/utils/ancestor-variables";
import {
  componentPropBindingFromRaw,
  findComponentPropEntry,
  manifestDefaultPropValue,
  type ComponentPropValuePlain,
} from "../../state/utils/component-prop-values";
import { selectDocumentRoot } from "../../state/utils/document-root";

// =============================================================================
// Identity key
// =============================================================================

/**
 * The identity key of a component instance — `local:<componentPath>` for an
 * in-document code component, `builtin:<componentSlug>` for a first-party
 * builtin, `catalog:<contentHash>` for a pinned catalog component. Nodes with
 * the same key share a manifest, so they can be edited as one batch; nodes with
 * different keys cannot.
 */
function componentIdentityKey(node: ComponentSnapshotNode): string {
  if (node.data.componentSource === "local") {
    return `local:${node.data.componentPath}`;
  }
  if (node.data.componentSource === "builtin") {
    return `builtin:${node.data.componentSlug}`;
  }
  return `catalog:${node.data.contentHash}`;
}

/** Narrows a snapshot node to a component node. */
function isComponentNode(node: SnapshotNode): node is ComponentSnapshotNode {
  return node.type === "component";
}

// =============================================================================
// Panel-code accessor (sibling seam)
// =============================================================================

/**
 * Reads the compiled panel code for a LOCAL component instance, or `undefined`
 * when unavailable. The compiled code + `hasPanel` flag live on the ready
 * artifact (`LocalComponentArtifact.hasPanel: boolean`, `.code?: string` —
 * threaded by the sandbox-transport work, retained only when `hasPanel`). Read
 * through a narrow structural view so a missing field degrades to "no custom
 * session" instead of a crash. Catalog components carry no local code, so a
 * custom session is local-only.
 */
export function resolvePanelCode(
  node: ComponentSnapshotNode,
  compiled: CodeComponentsState["compiled"],
  definitionId: string | undefined,
): string | undefined {
  if (node.data.componentSource !== "local" || definitionId === undefined) return undefined;
  const entry = compiled[definitionId] as
    | {
        readonly status?: string;
        readonly artifact?: { readonly hasPanel?: unknown; readonly code?: unknown };
      }
    | undefined;
  if (entry === undefined || entry.status !== "ready") return undefined;
  if (entry.artifact?.hasPanel !== true) return undefined;
  return typeof entry.artifact.code === "string" ? entry.artifact.code : undefined;
}

/**
 * Asynchronously resolves the panel code for a CATALOG component instance. When
 * the pinned catalog version declares `hasPanel`, its `panel.js` is fetched
 * from the version's `artifactBaseUrl` (§5.1) — deduped + cached per immutable
 * `contentHash` (see {@link ./catalog-panel-code}). Returns `undefined` while
 * the fetch is pending, on any soft failure (missing/oversized artifact,
 * network error), or when the node is local / has no catalog panel; a defined
 * result upgrades the slot from the default panel to a custom session.
 *
 * A soft fetch failure intentionally leaves the slot on the default panel with
 * NO error banner — that is a graceful degrade, distinct from a crashed custom
 * session (which the {@link CustomComponentPanel} banner surfaces).
 */
function useCatalogPanelCode(
  node: ComponentSnapshotNode | undefined,
  fetchPanelCode: FetchCatalogPanelCode,
): string | undefined {
  const store = usePaywallDesignerStore();
  const isCatalog = node !== undefined && node.data.componentSource !== "local";
  const contentHash = isCatalog ? node.data.contentHash : undefined;
  const version = useStore(store, (state) =>
    contentHash === undefined ? undefined : state.componentCatalog.byContentHash[contentHash],
  );
  const hasPanel = version?.hasPanel === true;
  const artifactBaseUrl = version?.artifactBaseUrl;

  // Store the fetched code KEYED by its contentHash so switching to another
  // catalog component never briefly returns a prior component's stale code —
  // the code is only surfaced when its key matches the current contentHash.
  const [resolved, setResolved] = useState<{ hash: string; code: string } | null>(null);

  useEffect(() => {
    if (!hasPanel || contentHash === undefined || artifactBaseUrl === undefined) {
      return;
    }
    let active = true;
    void fetchPanelCode(contentHash, artifactBaseUrl).then((code) => {
      if (!active) return;
      if (code === null) {
        if (import.meta.env.DEV) {
          console.warn(
            `[catalog-panel] no custom panel loaded for ${contentHash} — using default controls`,
          );
        }
        return;
      }
      setResolved({ hash: contentHash, code });
    });
    return () => {
      active = false;
    };
  }, [fetchPanelCode, hasPanel, contentHash, artifactBaseUrl]);

  if (!hasPanel || contentHash === undefined) return undefined;
  return resolved?.hash === contentHash ? resolved.code : undefined;
}

// =============================================================================
// Shared prop-row expansion (default panel + custom session `propField`)
// =============================================================================

/** One target's node id + its parsed stored binding for a prop. */
function propTargets(
  nodes: readonly ComponentSnapshotNode[],
  propName: string,
): readonly PropTargetBinding[] {
  return nodes.map((node) => {
    const storedEntry = findComponentPropEntry(node.data.props, propName);
    return {
      id: node.id,
      storedBinding:
        storedEntry === undefined ? undefined : componentPropBindingFromRaw(storedEntry.raw),
    };
  });
}

/**
 * The single implementation both the default panel and a custom session's
 * `propField`/`defaultProps` nodes expand through: one {@link PropFieldRow} per
 * named prop, wired to the batched multi-node prop actions over ALL selected
 * nodes. `variables` is the ancestor-variable intersection across targets.
 */
function usePropRowRenderer(
  nodes: readonly ComponentSnapshotNode[],
  store: PaywallDesignerStoreType,
): (propName: string, def: ComponentPropDefinition) => ReactNode {
  const dispatch = usePaywallDesignerActions();
  const documentRoot = useStore(store, selectDocumentRoot);
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);

  // Ancestor variables visible to EVERY target (intersection by id/aliasId). For
  // a single selection this is exactly the node's own ancestor set.
  const variables = useMemo(() => {
    const perNode = nodes.map((node) =>
      toLabeledVariables(collectAncestorVariables(documentRoot, node.id), node.id),
    );
    if (perNode.length === 0) return [];
    const [first, ...rest] = perNode;
    const keyOf = (v: { id: string; aliasId?: string }) => v.aliasId ?? v.id;
    return first!.filter((candidate) =>
      rest.every((list) => list.some((other) => keyOf(other) === keyOf(candidate))),
    );
  }, [nodes, documentRoot]);

  return useMemo(
    () => (propName, def) => (
      <PropFieldRow
        def={def}
        onResetProp={(name) => dispatch(removeComponentPropForNodes)({ nodeIds, propName: name })}
        onSetProp={(name, binding) =>
          dispatch(updateComponentPropBindingForNodes)({ binding, nodeIds, propName: name })
        }
        propName={propName}
        targets={propTargets(nodes, propName)}
        variables={variables}
      />
    ),
    [dispatch, nodeIds, nodes, variables],
  );
}

// =============================================================================
// Default (host-rendered) panel
// =============================================================================

function DefaultComponentPanel({
  nodes,
  manifest,
  store,
  banner,
}: {
  nodes: readonly ComponentSnapshotNode[];
  manifest: ComponentManifest | undefined;
  store: PaywallDesignerStoreType;
  /** Optional error banner shown above the rows (custom-session fallback). */
  banner?: ReactNode;
}) {
  const renderRow = usePropRowRenderer(nodes, store);
  const propEntries = useMemo(
    () => (manifest === undefined ? [] : Object.entries(manifest.props)),
    [manifest],
  );

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Props</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        {banner}
        {manifest === undefined ? (
          <p className="text-muted-foreground text-xs">
            This version is not in the project catalog, so its props can&apos;t be edited.
          </p>
        ) : propEntries.length === 0 ? (
          <p className="text-muted-foreground text-xs">This component declares no props.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {propEntries.map(([propName, def]) => (
              <div key={propName}>{renderRow(propName, def)}</div>
            ))}
          </div>
        )}
      </PanelSectionContent>
    </PanelSection>
  );
}

// =============================================================================
// Inputs construction
// =============================================================================

/**
 * Builds the {@link PanelSessionInputs} for a custom session from the store: one
 * entry per manifest prop with its effective value, mixed/bound flags, and kind
 * (refs carry the product id). `selection.count` is the target count.
 *
 * `data.products` is intentionally EMPTY: the host has no synchronous product
 * source here (the product picker resolves products lazily via react-query in the
 * default panel), and an empty list is defensible — `set-ref` intents from a
 * custom panel are validated against `getProducts()` and dropped until a real
 * source is wired, so nothing unsafe reaches the document. `data.variables` is
 * likewise empty; a custom panel resolves bound values through the host, not the
 * wire.
 */
function buildInputs(
  nodes: readonly ComponentSnapshotNode[],
  manifest: ComponentManifest | undefined,
): PanelSessionInputs {
  const props: Record<string, PanelPropInput> = {};

  if (manifest !== undefined) {
    for (const [propName, def] of Object.entries(manifest.props)) {
      const targets = propTargets(nodes, propName);
      const mixed = !bindingsUniform(targets);
      const representative = targets[0]?.storedBinding;
      const bound = targets.some((t) => t.storedBinding?.type === "variable-reference");

      let value: PanelPropInput["value"];
      let productId: string | undefined;
      const effective =
        !mixed && representative?.type === "literal"
          ? representative.value
          : manifestDefaultPropValue(def);
      if (effective !== undefined) {
        if (effective.key === "product") {
          productId = effective.value.productId;
          value = productId;
        } else {
          value = jsonForPropValue(effective);
        }
      }
      props[propName] = { value, mixed, bound, kind: def.kind, productId };
    }
  }

  return {
    props,
    selection: { count: nodes.length },
    data: { products: [], variables: {} },
  };
}

/** Extracts a JSON-friendly value from a plain prop value for the wire inputs. */
function jsonForPropValue(value: ComponentPropValuePlain): PanelPropInput["value"] {
  switch (value.key) {
    case "string":
    case "number":
    case "boolean":
      return value.value;
    case "string-array":
      return [...value.value];
    case "number-array":
      return [...value.value];
    case "boolean-array":
      return [...value.value];
    case "product":
      return value.value.productId;
  }
}

/** Structural deep-equality for uniform-binding detection across targets. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(objectA[key], objectB[key]));
}

function bindingsUniform(targets: readonly PropTargetBinding[]): boolean {
  if (targets.length <= 1) return true;
  const [first, ...rest] = targets;
  return rest.every((target) => deepEqual(target.storedBinding, first?.storedBinding));
}

// =============================================================================
// Custom (sandboxed) session
// =============================================================================

/** The sibling sandbox-transport factory, imported lazily/type-only until it lands. */
type CreatePanelSandboxTransport = (opts: {
  compiledCode: string;
  initialInputs: PanelSessionInputs;
  onIntents: (raw: unknown) => void;
  onFatal?: (message: string) => void;
}) => PanelTransport;

/**
 * The catalog panel-code fetcher seam (defaults to {@link fetchCatalogPanelCode}
 * hitting `<artifactBaseUrl>/panel.js`); tests inject a fake that resolves a
 * scripted code string without a network round-trip.
 */
type FetchCatalogPanelCode = (
  contentHash: string,
  artifactBaseUrl: string,
) => Promise<string | null>;

/**
 * Mounts a sandboxed component-panel session: builds the transport (via the
 * sibling factory), the gesture controller (paired to a host draft), and the
 * intent executor, then renders the emitted tree through {@link PanelTreeView}
 * with the shared prop-row expansion seam. On a fatal transport error it swaps
 * to the default panel with a retry banner.
 */
function CustomComponentPanel({
  nodes,
  manifest,
  store,
  compiledCode,
  createSandboxTransport,
}: {
  nodes: readonly ComponentSnapshotNode[];
  manifest: ComponentManifest;
  store: PaywallDesignerStoreType;
  compiledCode: string;
  createSandboxTransport: CreatePanelSandboxTransport;
}) {
  const dispatch = usePaywallDesignerActions();
  const draft = useDesignerDraft(store);
  const renderRow = usePropRowRenderer(nodes, store);

  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const identityKey = nodes[0] ? componentIdentityKey(nodes[0]) : "";

  // Fatal-error state (transport death) → fall back to the default panel. It is
  // state (not a ref) so the fallback renders reactively when the transport dies.
  const [fatal, setFatal] = useState<string | null>(null);
  const setFatalRef = useRef(setFatal);
  setFatalRef.current = setFatal;

  // The gesture controller + executor + transport are created once per identity
  // (identityKey + compiledCode). A recompile or selection-key change tears them
  // down and remounts (author state resets — documented).
  const sessionRef = useRef<{
    transport: PanelTransport;
    gestures: ReturnType<typeof createPanelGestureController>;
    executor: ReturnType<typeof createIntentExecutor>;
    key: string;
    code: string;
  } | null>(null);

  // The session identity is (component key + compiled code). A selection-key
  // change or a recompile (a fresh code string) tears the session down and
  // remounts — author state resets, documented. `compiledCode` is a store string
  // whose reference changes on recompile, so it keys the session directly (no
  // whole-string concat per render).
  const sessionKey = identityKey;

  // Latest getters so the executor always reads current targets/manifest.
  const getters = useRef({ nodes, manifest });
  getters.current = { nodes, manifest };

  if (
    sessionRef.current === null ||
    sessionRef.current.key !== sessionKey ||
    sessionRef.current.code !== compiledCode
  ) {
    sessionRef.current?.transport.dispose();
    sessionRef.current?.gestures.dispose();
    sessionRef.current?.executor.dispose();

    const gestures = createPanelGestureController();
    // Pair the sandbox gesture stream to a host draft (batches a drag into one
    // undo entry). The pairing callbacks come from the SLOT's `useDesignerDraft`.
    gestures.attachDraftPairing({
      begin: () => draft.begin(),
      commit: () => draft.commit(),
      discard: () => draft.discard(),
    });

    const executor = createIntentExecutor({
      getTargets: () => getters.current.nodes.map((node) => ({ nodeId: node.id })),
      getManifest: () => getters.current.manifest,
      getProducts: () => [],
      gestures,
      services: { toastError: () => undefined },
      dispatch,
      isPropBound: (propName) =>
        propTargets(getters.current.nodes, propName).some(
          (t) => t.storedBinding?.type === "variable-reference",
        ),
    });

    const transport = createSandboxTransport({
      compiledCode,
      initialInputs: buildInputs(nodes, manifest),
      onIntents: (raw) => executor.handle(raw),
      onFatal: (message) => {
        setFatalRef.current(message);
        gestures.notifySessionDeath();
      },
    });

    sessionRef.current = { transport, gestures, executor, key: sessionKey, code: compiledCode };
  }

  const session = sessionRef.current;

  // Push fresh inputs whenever the store-derived inputs change. The transport is
  // constructed with the first inputs, so the very first effect run is a no-op
  // (skipped via a per-session latch) — only subsequent changes push an update.
  const inputs = useMemo(() => buildInputs(nodes, manifest), [nodes, manifest]);
  const initialInputsPushedRef = useRef<PanelTransport | null>(null);
  useEffect(() => {
    if (initialInputsPushedRef.current !== session.transport) {
      initialInputsPushedRef.current = session.transport;
      return;
    }
    session.transport.update(inputs);
  }, [session, inputs]);

  // A selection change discards any open gesture draft.
  useEffect(() => {
    session.gestures.notifySelectionChange();
  }, [session, nodeIds]);

  // Dispose on unmount / session-key change.
  useEffect(
    () => () => {
      session.transport.dispose();
      session.gestures.dispose();
      session.executor.dispose();
    },
    [session],
  );

  const renderContext = useMemo<PanelRenderContext>(
    () => ({
      gestures: session.gestures,
      expandPropField: (name) => {
        const def = getters.current.manifest.props[name];
        return def ? renderRow(name, def) : null;
      },
      expandDefaultProps: (exclude) => {
        const excludeSet = new Set(exclude);
        return (
          <div className="flex flex-col gap-2">
            {Object.entries(getters.current.manifest.props)
              .filter(([propName]) => !excludeSet.has(propName))
              .map(([propName, def]) => (
                <div key={propName}>{renderRow(propName, def)}</div>
              ))}
          </div>
        );
      },
    }),
    [session, renderRow],
  );

  const handleRetry = useCallback(() => {
    setFatal(null);
    session.transport.restart();
  }, [session]);

  // Fatal transport error → default panel with a retry banner.
  if (fatal !== null) {
    return (
      <DefaultComponentPanel
        banner={
          <div className="mb-2 flex flex-col gap-1 rounded-sm border border-destructive/40 bg-destructive/10 p-2">
            <span className="text-destructive text-xs">
              Custom panel failed — showing default controls
            </span>
            <Button className="self-start" onClick={handleRetry} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        }
        manifest={manifest}
        nodes={nodes}
        store={store}
      />
    );
  }

  return <PanelTreeView renderContext={renderContext} transport={session.transport} />;
}

// =============================================================================
// Slot entry
// =============================================================================

/**
 * The `componentProps` slot. Computes the shared identity key across the selected
 * nodes; renders NOTHING when the selection is not a homogeneous set of component
 * nodes (mixed keys or a non-component in the set — PanelStack applicability
 * already excludes non-component selections, but same-type/different-key is
 * handled here). Otherwise it edits all matching nodes as one batch: a custom
 * session when the component's compiled code declares a panel, else the default
 * host panel.
 */
export function ComponentPanelHost({
  nodes,
  createSandboxTransport = createPanelSandboxTransport,
  fetchPanelCode = fetchCatalogPanelCode,
}: {
  nodes: readonly SnapshotNode[];
  /**
   * The sandbox-transport factory. Defaults to the real iframe transport
   * ({@link createPanelSandboxTransport}); tests inject a fake that emits
   * scripted snapshots without an iframe.
   */
  createSandboxTransport?: CreatePanelSandboxTransport;
  /**
   * The catalog panel-code fetcher. Defaults to {@link fetchCatalogPanelCode}
   * (real `<artifactBaseUrl>/panel.js` fetch, deduped + size-capped); tests
   * inject a fake that resolves scripted code without a network call.
   */
  fetchPanelCode?: FetchCatalogPanelCode;
}): ReactNode {
  const store = usePaywallDesignerStore();
  const compiled = useStore(store, (state) => state.codeComponents.compiled);

  const componentNodes = useMemo(() => nodes.filter(isComponentNode), [nodes]);
  const homogeneous = useMemo(() => {
    if (componentNodes.length === 0 || componentNodes.length !== nodes.length) return null;
    const keys = new Set(componentNodes.map(componentIdentityKey));
    return keys.size === 1 ? componentNodes : null;
  }, [componentNodes, nodes]);

  const firstNode = homogeneous?.[0];
  const manifest = useComponentManifest((firstNode ?? nodes[0]) as ComponentSnapshotNode);

  // Local code resolves synchronously from the store; catalog code is fetched
  // async (default panel renders until it arrives, then the slot upgrades).
  const localDefinitionId = useStore(store, (state) =>
    firstNode !== undefined && firstNode.data.componentSource === "local"
      ? definitionForComponentPath(state, firstNode.data.componentPath)?.id
      : undefined,
  );
  const localCode = firstNode
    ? resolvePanelCode(firstNode, compiled, localDefinitionId)
    : undefined;
  const catalogCode = useCatalogPanelCode(firstNode, fetchPanelCode);
  const compiledCode = localCode ?? catalogCode;

  if (homogeneous === null || firstNode === undefined) {
    return null;
  }

  if (manifest !== undefined && compiledCode !== undefined) {
    return (
      <CustomComponentPanel
        compiledCode={compiledCode}
        createSandboxTransport={createSandboxTransport}
        manifest={manifest}
        nodes={homogeneous}
        store={store}
      />
    );
  }

  return <DefaultComponentPanel manifest={manifest} nodes={homogeneous} store={store} />;
}
