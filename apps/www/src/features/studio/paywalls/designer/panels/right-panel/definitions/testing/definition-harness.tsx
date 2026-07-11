// @vitest-environment jsdom

/**
 * The reusable headless harness EVERY built-in panel-definition test drives a
 * definition through. It builds a REAL designer store (the same commander +
 * mimic middleware as production, over an offline stub document), runs a
 * definition through the same in-process transport + `wrap` the live
 * {@link ../../builtin-panel-host.BuiltinPanelHost} uses (store context + stubbed
 * host services + the selection channel), and exposes the emitted wire tree, an
 * event dispatcher, node finders, and store/draft/undo/action inspection.
 *
 * Every emission is asserted valid: {@link mountPanelDefinition} decodes the
 * current tree through the host gate ({@link decodePanelTree}, serialize →
 * decode) on construction and after every {@link PanelHarness.dispatch}, so a
 * definition that drifts from the wire contract fails the test automatically.
 *
 * Later section migrations reuse this verbatim — seed nodes/selection with
 * {@link seedNodes}, mount the definition, then assert structure via the finders
 * and behavior via `dispatch` + the store/draft/undo/action helpers.
 */
import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentBoundAction } from "@voidhash/mimic-schema";
import type { PanelContext, PanelSessionInputs } from "@voidhash/paywalls/panel";
import type { Command as CommandObject } from "@voidhash/mimic/zustand-commander";

import { createInProcessTransport } from "../../../../panel-runtime/in-process-transport";
import type { PanelRender, PanelWrap } from "../../../../panel-runtime/in-process-transport";
import {
  decodePanelTree,
  type PanelNode,
  type PanelTree,
} from "../../../../panel-runtime/schema";
import type { PanelTransport } from "../../../../panel-runtime/transport";
import {
  PanelHostServicesProvider,
  type ComponentUpdatePlan,
  type PanelHostServices,
} from "../../../../panel-runtime/panel-host-services";
import { createDesignerStore, PaywallStoreContext } from "../../../../state/designer-store";
import type { PaywallDesignerStoreType } from "../../../../state/designer-store";
import type {
  ComponentCatalogEntry,
  ComponentCatalogVersion,
} from "../../../../state/designer-store-state";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../../../state/testing/offline-document";
import { insertCodeComponent } from "../../../../state/utils/code-component-writes";
import { definitionForComponentPath } from "../../../../state/utils/code-components";
import {
  createDefinitionSelectionStore,
  DefinitionSelectionProvider,
} from "../definition-selection";

// Re-exported so a definition test has a single import site for the whole
// harness (document factory + seeding + mount + finders).
export { createOfflineDesignerDocument, type OfflineDesignerDocument };

// =============================================================================
// Store seeding
// =============================================================================

/** One node to seed under the document's screen, plus optional style overrides. */
export interface SeedNode {
  /** The node type to insert under the screen (e.g. `"path"`, `"text"`, `"view"`). */
  readonly type: "view" | "text" | "shape" | "path";
  /** Style fields to write onto the node after insertion (merged into `data.style`). */
  readonly style?: Record<string, unknown>;
  /** An optional stable label a test can look the node up by later. */
  readonly key?: string;
}

/** The result of seeding: the created node ids, keyed by insertion order and label. */
export interface SeededNodes {
  /** The created node ids in insertion order. */
  readonly nodeIds: string[];
  /** The created node ids keyed by their {@link SeedNode.key} (when provided). */
  readonly byKey: Record<string, string>;
}

/**
 * A seed for a live/committed style test: writes `style` directly onto the
 * node's committed `data.style` so the node presents that style before the
 * definition renders. The write mirrors what the schema stores (unwrapped
 * scalar fields), so path/text default fields (fillEnabled, color, …) can be
 * overridden per test.
 */
export function seedNodes(
  doc: OfflineDesignerDocument,
  seeds: readonly SeedNode[],
): SeededNodes {
  const { screenId } = seededIds(doc);
  const nodeIds: string[] = [];
  const byKey: Record<string, string> = {};
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    for (const seed of seeds) {
      // A `path` is only valid inside a `shape` container (never directly under
      // a screen), so a path seed inserts a wrapping shape first and nests the
      // path in it — the returned id is always the seed node itself.
      const node =
        seed.type === "path"
          ? screen.children.insertLast({ type: "shape" }).children.insertLast({ type: "path" })
          : screen.children.insertLast({ type: seed.type });
      nodeIds.push(node.id);
      if (seed.key) byKey[seed.key] = node.id;
      if (seed.style) {
        // Merge onto the node's current style. The typed node proxy flattens its
        // `data` fields, so `update({ style })` seeds only the provided style
        // fields (leaving schema defaults for the rest) — mirroring how every
        // style action writes (`proxy.update({ style })`).
        (node as { update: (value: { style: Record<string, unknown> }) => void }).update({
          style: seed.style,
        });
      }
    }
  });
  return { nodeIds, byKey };
}

/** A minimal always-true DNF condition for a seeded state entry. */
const ALWAYS_TRUE_CONDITION = {
  type: "or",
  value: [
    {
      type: "and",
      value: [
        {
          type: "equals",
          value: {
            left: { type: "literal", value: { key: "boolean", value: true } },
            right: { type: "literal", value: { key: "boolean", value: true } },
          },
        },
      ],
    },
  ],
} as const;

/**
 * Pushes one state entry (with the given `style` overrides) onto a stateful node
 * and returns its ARRAY-ENTRY id — the id used to select the state (mirrors
 * `addNodeState`, which returns `push(...).id`, the entry id, not the inner
 * `value.id`). Used to exercise the override-reset affordance: seeding a `color`
 * override then selecting the entry makes the reset context active.
 */
export function seedStateOverride(
  doc: OfflineDesignerDocument,
  nodeId: string,
  overrides: { name?: string; style: Record<string, unknown> },
): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    if (!node) throw new Error(`seedStateOverride: node ${nodeId} not found`);
    const created = (
      node as unknown as {
        data: {
          states: {
            push: (value: unknown) => { id: string };
          };
        };
      }
    ).data.states.push({
      // The schema requires an inner `id`; selection addresses the entry id.
      id: `state-value-${Math.random().toString(36).slice(2, 8)}`,
      condition: ALWAYS_TRUE_CONDITION,
      name: overrides.name ?? "Hovered",
      overrides: { style: overrides.style },
    });
    entryId = created.id;
  });
  return entryId;
}

/**
 * Selects an override state for a node in the store, activating the override
 * reset context for definitions that read it. Passing `null` clears it.
 */
export function selectState(
  store: PaywallDesignerStoreType,
  nodeId: string,
  stateId: string | null,
): void {
  store.setState((state) => ({
    ...state,
    stateOverrideSelection: { ...state.stateOverrideSelection, [nodeId]: stateId },
  }));
}

// =============================================================================
// Component node + catalog seeding
// =============================================================================

/** A stored action binding to push onto a seeded component node. */
export interface SeedActionBinding {
  readonly name: string;
  readonly action: ComponentBoundAction;
}

/** A stored prop binding to push onto a seeded component node (raw binding value). */
export interface SeedPropBinding {
  readonly name: string;
  readonly value: unknown;
}

/** The identity + optional stored bindings of a seeded `component` node. */
export interface SeedComponentNode {
  readonly componentSlug: string;
  readonly componentVersion: number;
  readonly contentHash: string;
  readonly name?: string;
  readonly previewState?: string;
  /**
   * Local code-component instance: a `codeComponent` definition is inserted at
   * `components/<localComponentId>.tsx` and the instance references it via
   * `componentSource: "local"` + `componentPath` (catalog identity fields carry
   * sentinels). The compiled artifact keys by the definition node id — seed it
   * with {@link seedCompiledComponent} passing the same identity string.
   */
  readonly localComponentId?: string;
  /**
   * Builtin instance: `componentSource: "builtin"` resolved by `componentSlug`
   * from the static `@voidhash/paywall-builtins` registry (no catalog row,
   * no pinned hash — version/hash carry sentinels).
   */
  readonly builtin?: boolean;
  readonly actionBindings?: readonly SeedActionBinding[];
  readonly props?: readonly SeedPropBinding[];
}

/**
 * The canonical document-relative path a local component identity string maps to.
 * The instance's `componentPath` and its `codeComponent` definition node's `path`
 * both use this value.
 */
function componentPathForIdentity(localComponentId: string): string {
  return `components/${localComponentId}.tsx`;
}

/**
 * Inserts a `codeComponent` definition node at `components/<localComponentId>.tsx`
 * (idempotent per identity string), returning its definition node id — the key
 * `codeComponents.compiled` is addressed by.
 */
function seedCodeComponentDefinition(
  doc: OfflineDesignerDocument,
  localComponentId: string,
): string {
  const path = componentPathForIdentity(localComponentId);
  const existing = definitionForComponentPath(
    { mimic: { snapshot: doc.getSnapshot() } } as never,
    path,
  );
  if (existing !== undefined) return existing.id;
  let defId = "";
  doc.transaction((root) => {
    const node = insertCodeComponent(root as never, { path, source: "// seed" });
    if (node === null) throw new Error("failed to insert code-component definition");
    defId = node;
  });
  return defId;
}

/**
 * Inserts a `component` node under the seeded screen and pushes any stored
 * action/prop bindings onto it (the `{name, action}` / `{name, value}` shapes the
 * schema array proxy wraps into `{id, value}` entries — the same shape the prop
 * actions write). Returns the created node id. A `localComponentId` seeds a LOCAL
 * component instance (its manifest resolves from `codeComponents.compiled`).
 */
export function seedComponentNode(
  doc: OfflineDesignerDocument,
  seed: SeedComponentNode,
): string {
  // A local instance references a `codeComponent` definition by path; insert that
  // definition first so the manifest resolves (path → definition → compiled).
  if (seed.localComponentId !== undefined) {
    seedCodeComponentDefinition(doc, seed.localComponentId);
  }
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const local = seed.localComponentId !== undefined;
    const builtin = seed.builtin === true;
    const data: Record<string, unknown> = {
      type: "component",
      componentSource: local ? "local" : builtin ? "builtin" : "catalog",
      componentPath: local ? componentPathForIdentity(seed.localComponentId!) : "",
      // A builtin resolves by slug; a local instance's catalog identity fields
      // carry sentinels; a catalog instance carries its pinned identity.
      componentSlug: local ? "" : seed.componentSlug,
      componentVersion: local || builtin ? 0 : seed.componentVersion,
      contentHash: local || builtin ? "" : seed.contentHash,
      name: seed.name ?? seed.componentSlug,
      previewState: seed.previewState ?? "default",
    };
    // The component node data carries a fixed `type` discriminant; the insert
    // input is otherwise structural, so a single cast at the seam suffices.
    const node = (
      screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
    ).insertLast(data);
    nodeId = node.id;
    const proxy = node as unknown as {
      data: {
        actionBindings: { push: (v: unknown) => void };
        props: { push: (v: unknown) => void };
      };
    };
    for (const binding of seed.actionBindings ?? []) {
      proxy.data.actionBindings.push({ action: binding.action, name: binding.name });
    }
    for (const binding of seed.props ?? []) {
      proxy.data.props.push({ name: binding.name, value: binding.value });
    }
  });
  return nodeId;
}

/**
 * Seeds a catalog entry (keyed by slug) and mirrors every listed version into
 * `byContentHash` (so a node pinned to that contentHash resolves its manifest).
 * The `latest` version is always mirrored; pass extra `pinnedVersions` for older
 * pinned versions a node might reference.
 */
export function seedComponentCatalog(
  store: PaywallDesignerStoreType,
  entry: ComponentCatalogEntry,
  pinnedVersions: readonly ComponentCatalogVersion[] = [],
): void {
  store.setState((state) => {
    const byContentHash = { ...state.componentCatalog.byContentHash };
    for (const version of [entry.latest, ...pinnedVersions]) {
      byContentHash[version.contentHash] = version;
    }
    return {
      ...state,
      componentCatalog: {
        byContentHash,
        components: { ...state.componentCatalog.components, [entry.slug]: entry },
      },
    };
  });
}

/**
 * Seeds a compiled LOCAL component artifact so a local component instance
 * resolves its manifest via `useComponentManifest`. The compiled store is keyed
 * by the DEFINITION node id — resolved from the seeded definition at
 * `components/<localComponentId>.tsx` (via {@link seedComponentNode}), falling
 * back to the raw identity string when no definition was seeded.
 */
export function seedCompiledComponent(
  store: PaywallDesignerStoreType,
  localComponentId: string,
  manifest: ComponentManifest,
): void {
  const key =
    definitionForComponentPath(store.getState(), componentPathForIdentity(localComponentId))?.id ??
    localComponentId;
  store.setState((state) => ({
    ...state,
    codeComponents: {
      ...state.codeComponents,
      compiled: {
        ...state.codeComponents.compiled,
        [key]: {
          artifact: { hasPanel: false, manifest, previewTrees: {} },
          sourceHash: "seed",
          status: "ready",
        },
      },
    },
  }));
}

/**
 * Sets the ephemeral preview-state selection for a component node id (mirrors the
 * `setComponentPreviewStateSelection` action's state write). Passing `null`
 * clears it back to the persisted default.
 */
export function selectComponentPreviewState(
  store: PaywallDesignerStoreType,
  nodeId: string,
  previewState: string | null,
): void {
  store.setState((state) => {
    const next = { ...state.componentPreviewStateSelection };
    if (previewState === null) {
      delete next[nodeId];
    } else {
      next[nodeId] = previewState;
    }
    return { ...state, componentPreviewStateSelection: next };
  });
}

// =============================================================================
// Host services stub
// =============================================================================

/** Records every {@link PanelHostServices} call for assertion. */
export interface HostServicesLog {
  readonly openStateManager: string[];
  readonly confirmComponentUpdate: ComponentUpdatePlan[];
  readonly toastError: string[];
}

const createHostServicesStub = (
  log: HostServicesLog,
  confirmResult: boolean,
): PanelHostServices => ({
  openStateManager(nodeId) {
    log.openStateManager.push(nodeId);
  },
  async confirmComponentUpdate(plan) {
    log.confirmComponentUpdate.push(plan);
    return confirmResult;
  },
  toastError(message) {
    log.toastError.push(message);
  },
});

// =============================================================================
// Tree finders
// =============================================================================

/** Depth-first walk of a panel tree, yielding every node. */
export function* walkTree(node: PanelNode): Generator<PanelNode> {
  yield node;
  for (const child of node.children ?? []) {
    yield* walkTree(child);
  }
}

/** Returns every node of `type` in the tree, in document order. */
export function findNodesByType(root: PanelNode, type: string): PanelNode[] {
  const out: PanelNode[] = [];
  for (const node of walkTree(root)) {
    if (node.type === type) out.push(node);
  }
  return out;
}

/** Returns the first node of `type`, or `undefined`. */
export function findNodeByType(root: PanelNode, type: string): PanelNode | undefined {
  for (const node of walkTree(root)) {
    if (node.type === type) return node;
  }
  return undefined;
}

/**
 * Returns the first node whose `props.label` (or `props.title`) equals `label`.
 * Handy for `field`/`section` chrome lookups.
 */
export function findNodeByLabel(root: PanelNode, label: string): PanelNode | undefined {
  for (const node of walkTree(root)) {
    if (node.props.label === label || node.props.title === label) return node;
  }
  return undefined;
}

// =============================================================================
// Harness
// =============================================================================

/** Options for {@link mountPanelDefinition}. */
export interface MountOptions {
  /** The node ids the definition edits (its selection). */
  readonly nodeIds: readonly string[];
  /** The result `confirmComponentUpdate` resolves to (defaults to `true`). */
  readonly confirmResult?: boolean;
}

/** The live handle a definition test drives. */
export interface PanelHarness {
  /** The real designer store (commander + mimic middleware over the offline doc). */
  readonly store: PaywallDesignerStoreType;
  /** The offline document backing the store. */
  readonly doc: OfflineDesignerDocument;
  /** Recorded host-service calls. */
  readonly hostLog: HostServicesLog;
  /**
   * The current emitted wire tree — decoded through the host gate every call, so
   * reading it double-asserts validity. Throws if the transport is not `ready`
   * or the tree is invalid.
   */
  tree(): PanelTree;
  /** Fires an event `name` on node `nodeId` with `args`; re-asserts the new tree. */
  dispatch(nodeId: number, name: string, args?: readonly unknown[]): void;
  /** The number of commander undo entries currently on the stack. */
  undoDepth(): number;
  /** Whether a draft is currently active on the store (a gesture is in flight). */
  draftActive(): boolean;
  /** The number of transactions the offline transport has submitted (committed batches). */
  submittedCount(): number;
  /** Reads the effective committed `data.style` of a seeded node id. */
  nodeStyle(nodeId: string): Record<string, unknown>;
  /** Tears down the transport + restores any spied actions. */
  dispose(): void;
}

/** A dispatched-command record: `{ command, params }` in dispatch order. */
export interface ActionCall<TParams = unknown> {
  readonly command: CommandObject<never, TParams, unknown, never>;
  readonly params: TParams;
}

/**
 * Wraps a commander action so every dispatch of it is recorded into `calls`
 * (delegating to the original `fn`). Returns a `restore()` that reinstalls the
 * original — call it on harness teardown. Test-scoped: mutates the action object
 * in place, so a test that watches an action MUST dispose the harness.
 */
export function watchAction<TParams, TReturn>(
  action: CommandObject<never, TParams, TReturn, never>,
  calls: ActionCall<TParams>[],
): () => void {
  const target = action as unknown as {
    fn: (ctx: unknown, params: TParams) => TReturn;
  };
  const original = target.fn;
  target.fn = (ctx: unknown, params: TParams): TReturn => {
    calls.push({ command: action as never, params });
    return original(ctx, params);
  };
  return () => {
    target.fn = original;
  };
}

/**
 * Builds and mounts a definition on a fresh seeded store. Returns the
 * {@link PanelHarness}. The caller seeds nodes first (via {@link seedNodes}) and
 * passes their ids as `nodeIds`.
 *
 * @param definition - the panel definition `(ctx) => ReactNode` under test.
 * @param doc - the offline document (already seeded by the caller).
 * @param options - the selection + host-service options.
 */
export function mountPanelDefinition(
  definition: PanelRender,
  doc: OfflineDesignerDocument,
  options: MountOptions,
): PanelHarness {
  const store = createDesignerStore(
    doc as unknown as Parameters<typeof createDesignerStore>[0],
  );

  const hostLog: HostServicesLog = {
    openStateManager: [],
    confirmComponentUpdate: [],
    toastError: [],
  };
  const services = createHostServicesStub(hostLog, options.confirmResult ?? true);
  const selectionStore = createDefinitionSelectionStore(options.nodeIds);

  const wrap: PanelWrap = (children) => (
    <PaywallStoreContext.Provider value={store}>
      <PanelHostServicesProvider value={services}>
        <DefinitionSelectionProvider value={selectionStore}>
          {children}
        </DefinitionSelectionProvider>
      </PanelHostServicesProvider>
    </PaywallStoreContext.Provider>
  );

  const inputs: PanelSessionInputs = {
    props: {},
    selection: { count: options.nodeIds.length },
    data: { products: [], variables: {} },
  };

  const transport: PanelTransport = createInProcessTransport({
    render: definition,
    initialInputs: inputs,
    wrap,
  });

  /** Reads + asserts the current tree through the host gate (serialize → decode). */
  const readTree = (): PanelTree => {
    const snapshot = transport.getSnapshot();
    if (snapshot.status === "error") {
      throw new Error(`panel session errored: ${snapshot.message}`);
    }
    if (snapshot.status !== "ready") {
      throw new Error(`panel session not ready (status: ${snapshot.status})`);
    }
    // Serialize → decode so the assertion mirrors the real sandbox trust
    // boundary (a string input pays the byte cap too).
    const decoded = decodePanelTree(JSON.stringify(snapshot.tree));
    if (!decoded.ok) {
      throw new Error(`emitted panel tree is invalid: ${decoded.error}`);
    }
    return decoded.tree;
  };

  const nodeStyle = (nodeId: string): Record<string, unknown> => {
    const snapshot = store.getState().mimic.snapshot;
    if (!snapshot) throw new Error("document snapshot not ready");
    const root = snapshot[0] as { children?: unknown } | undefined;
    const find = (node: unknown): Record<string, unknown> | undefined => {
      const n = node as {
        id?: string;
        data?: { style?: Record<string, unknown> };
        children?: unknown[];
      };
      if (n.id === nodeId) return n.data?.style ?? {};
      for (const child of n.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return undefined;
    };
    const style = find(root);
    if (!style) throw new Error(`node ${nodeId} not found in snapshot`);
    return style;
  };

  // Assert the very first emission is valid.
  readTree();

  return {
    store,
    doc,
    hostLog,
    tree: readTree,
    dispatch(nodeId, name, args = []) {
      transport.dispatch({ nodeId, name, args });
      readTree();
    },
    undoDepth() {
      return store.getState()._commander.undoStack.length;
    },
    draftActive() {
      return store.getState()._commander.activeDraft !== null;
    },
    submittedCount() {
      // The offline stub transport never acks, so the document's pending queue
      // equals the number of submitted transaction batches. A direct action is
      // one batch; a whole draft commits as one batch too.
      return doc.getPendingCount();
    },
    nodeStyle,
    dispose() {
      transport.dispose();
    },
  };
}
