// @vitest-environment jsdom

/**
 * The `componentProps` slot ({@link ComponentPanelHost}) end-to-end: the default
 * host panel (single + multi select, mixed detection, write-to-all + one undo,
 * reset, bound-prop row, different-key → nothing) AND a custom session driven by
 * a FAKE {@link PanelTransport} (scripted snapshots): the custom tree renders
 * through `PanelTreeView` with the `expandPropField` seam, intents flow
 * executor → batched actions with N targets → ONE undo entry, and a transport
 * error snapshot falls back to the default panel with a Retry.
 */
import type {
  ComponentManifest,
  ComponentPropDefinition,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Effect } from "effect";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({}),
}));

import { AuthProvider } from "@/features/studio/components/auth-context";

import { PanelTreeView } from "../../panel-runtime/host-renderer";
import type {
  PanelDispatchEvent,
  PanelSnapshot,
  PanelTransport,
} from "../../panel-runtime/transport";
import type { PanelTree } from "../../panel-runtime/schema";
import { readComponentPropEntries } from "../../state/utils/component-node-writes";
import { insertCodeComponent } from "../../state/utils/code-component-writes";
import { definitionForComponentPath } from "../../state/utils/code-components";
import { createDesignerStore, PaywallStoreContext } from "../../state/designer-store";
import type { PaywallDesignerStoreType } from "../../state/designer-store";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../state/testing/offline-document";
import { ComponentPanelHost, resolvePanelCode } from "./component-panel-host";

// PanelTreeView + host-renderer types are imported so this file compiles against
// the same renderer the slot mounts (and to exercise the seam directly below).
void PanelTreeView;

// oxlint-disable-next-line effect/noTestLifecycleHooks -- React Testing Library's DOM teardown: `cleanup` must run between renders on the shared jsdom document, and the panel/store harness is created by plain React renders outside any Effect scope, so there is no Scope for Effect.acquireRelease to close.
afterEach(() => cleanup());

// =============================================================================
// Fixtures
// =============================================================================

const manifest: ComponentManifest = {
  manifestVersion: 2,
  props: {
    title: { kind: "string" },
    count: { kind: "number" },
  } as Record<string, ComponentPropDefinition>,
} as unknown as ComponentManifest;

/**
 * The canonical document-relative path a local component identity string maps to.
 * A local instance references its definition by this `componentPath`, and the
 * matching `codeComponent` definition node stores the same `path`.
 */
function componentPathFor(localComponentId: string): string {
  return `components/${localComponentId}.tsx`;
}

/**
 * Seeds a code-component DEFINITION node for `localComponentId` (path
 * `components/<localComponentId>.tsx`), returning its definition node id — the id
 * the compiled-artifact store is keyed by. Idempotent per identity string.
 */
function seedDefinition(doc: OfflineDesignerDocument, localComponentId: string): string {
  const path = componentPathFor(localComponentId);
  const existing = definitionForComponentPath({ mimic: { snapshot: doc.getSnapshot() } } as never, path);
  if (existing !== undefined) return existing.id;
  let defId = "";
  doc.transaction((root) => {
    const node = insertCodeComponent(root as never, { path, source: "// seed" });
    if (node === null) return Effect.runSync(Effect.die(new Error("failed to insert code-component definition")));
    defId = node;
  });
  return defId;
}

/**
 * Seeds a local component instance node (with an optional stored title binding)
 * referencing the definition at `components/<localComponentId>.tsx`, inserting
 * that definition first. Returns the instance node id.
 */
function seedNode(
  doc: OfflineDesignerDocument,
  localComponentId: string,
  contentHash: string,
  props: readonly { name: string; value: unknown }[] = [],
): string {
  void contentHash;
  seedDefinition(doc, localComponentId);
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
    const node = (
      screen.children as unknown as { insertLast: (v: unknown) => { id: string } }
    ).insertLast({
      type: "component",
      componentSource: "local",
      componentPath: componentPathFor(localComponentId),
      componentSlug: "",
      componentVersion: 0,
      contentHash: "",
      name: "card",
      previewState: "default",
    });
    nodeId = node.id;
    const proxy = node as unknown as { data: { props: { push: (v: unknown) => void } } };
    for (const binding of props) proxy.data.props.push({ name: binding.name, value: binding.value });
  });
  return nodeId;
}

/** Resolves the definition node id the compiled store keys for a local identity. */
function definitionIdFor(store: PaywallDesignerStoreType, localComponentId: string): string | undefined {
  return definitionForComponentPath(store.getState(), componentPathFor(localComponentId))?.id;
}

/**
 * Seeds the compiled artifact for a local component (manifest + optional panel
 * code). The compiled store is keyed by the DEFINITION node id — resolved from
 * the instance's `componentPath` when a definition was seeded (via
 * {@link seedNode}), else the raw identity string (the direct `resolvePanelCode`
 * tests that never seed a document node).
 */
function seedCompiled(
  store: PaywallDesignerStoreType,
  localComponentId: string,
  options: { hasPanel?: boolean; code?: string } = {},
): void {
  const key = definitionIdFor(store, localComponentId) ?? localComponentId;
  store.setState((state) => ({
    ...state,
    codeComponents: {
      ...state.codeComponents,
      compiled: {
        ...state.codeComponents.compiled,
        [key]: {
          artifact: {
            manifest,
            previewTrees: {},
            hasPanel: options.hasPanel ?? false,
            code: options.code,
          },
          sourceHash: "seed",
          status: "ready",
        },
      },
    },
  }));
}

/** Seeds a CATALOG component node pinned to `contentHash`. */
function seedCatalogNode(doc: OfflineDesignerDocument, contentHash: string): string {
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
    const node = (
      screen.children as unknown as { insertLast: (v: unknown) => { id: string } }
    ).insertLast({
      type: "component",
      componentSource: "catalog",
      componentPath: "",
      componentSlug: "card",
      componentVersion: 1,
      contentHash,
      name: "card",
      previewState: "default",
    });
    nodeId = node.id;
  });
  return nodeId;
}

/**
 * Seeds a BUILTIN component instance node resolved by `slug`. Builtins carry no
 * catalog row and no pinned hash — their manifest resolves from the static
 * `@voidhash/paywall-builtins` registry.
 */
function seedBuiltinNode(doc: OfflineDesignerDocument, slug: string): string {
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
    const node = (
      screen.children as unknown as { insertLast: (v: unknown) => { id: string } }
    ).insertLast({
      type: "component",
      componentSource: "builtin",
      componentPath: "",
      componentSlug: slug,
      componentVersion: 0,
      contentHash: "",
      name: "badge",
      previewState: "default",
    });
    nodeId = node.id;
  });
  return nodeId;
}

/** Seeds a pinned catalog version into `componentCatalog.byContentHash`. */
function seedCatalog(
  store: PaywallDesignerStoreType,
  contentHash: string,
  options: { hasPanel?: boolean; artifactBaseUrl?: string } = {},
): void {
  store.setState((state) => ({
    ...state,
    componentCatalog: {
      ...state.componentCatalog,
      byContentHash: {
        ...state.componentCatalog.byContentHash,
        [contentHash]: {
          slug: "card",
          version: 1,
          contentHash,
          manifest,
          hasPanel: options.hasPanel ?? false,
          previewStates: ["default"],
          artifactBaseUrl: options.artifactBaseUrl ?? `https://cdn/c/${contentHash}`,
          createdAt: new Date(),
        },
      },
    },
  }));
}

function makeStore(doc: OfflineDesignerDocument): PaywallDesignerStoreType {
  return createDesignerStore(doc as unknown as Parameters<typeof createDesignerStore>[0]);
}

/** Reads the store snapshot's node for the slot (the SnapshotNode the slot edits). */
function snapshotNode(store: PaywallDesignerStoreType, nodeId: string): unknown {
  const snapshot = store.getState().mimic.snapshot;
  const find = (node: unknown): unknown => {
    const n = node as { id?: string; children?: unknown[] };
    if (n.id === nodeId) return n;
    for (const child of n.children ?? []) {
      const found = find(child);
      if (found) return found;
    }
    return undefined;
  };
  return find((snapshot as unknown[])[0]);
}

const renderSlot = (store: PaywallDesignerStoreType, ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider user={null as never}>
        <PaywallStoreContext.Provider value={store}>{ui}</PaywallStoreContext.Provider>
      </AuthProvider>
    </QueryClientProvider>,
  );

function undoDepth(store: PaywallDesignerStoreType): number {
  return (store.getState() as unknown as { _commander: { undoStack: unknown[] } })._commander
    .undoStack.length;
}

function storedTitle(doc: OfflineDesignerDocument, nodeId: string): unknown {
  return readComponentPropEntries(doc.root, nodeId).find((e) => e.name === "title")?.raw;
}

// =============================================================================
// resolvePanelCode
// =============================================================================

describe("resolvePanelCode", () => {
  test("returns code only for a ready local component with hasPanel + code", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    // No document definition seeded, so `seedCompiled` keys the compiled entry by
    // the raw identity string — which is exactly the definition id passed below.
    seedCompiled(store, "lc1", { hasPanel: true, code: "export default 1" });
    expect(
      resolvePanelCode(
        { data: { componentSource: "local", componentPath: "components/lc1.tsx" } } as never,
        store.getState().codeComponents.compiled,
        "lc1",
      ),
    ).toBe("export default 1");
  });

  test("returns undefined without hasPanel, without code, or for catalog", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    seedCompiled(store, "lcNoPanel", { hasPanel: false, code: "x" });
    seedCompiled(store, "lcNoCode", { hasPanel: true });
    const compiled = store.getState().codeComponents.compiled;
    expect(
      resolvePanelCode(
        { data: { componentSource: "local", componentPath: "components/lcNoPanel.tsx" } } as never,
        compiled,
        "lcNoPanel",
      ),
    ).toBeUndefined();
    expect(
      resolvePanelCode(
        { data: { componentSource: "local", componentPath: "components/lcNoCode.tsx" } } as never,
        compiled,
        "lcNoCode",
      ),
    ).toBeUndefined();
    expect(
      resolvePanelCode(
        { data: { componentSource: "catalog", contentHash: "h" } } as never,
        compiled,
        undefined,
      ),
    ).toBeUndefined();
  });
});

// =============================================================================
// Default panel
// =============================================================================

describe("ComponentPanelHost — default panel", () => {
  test("renders one row per manifest prop for a single selection", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedNode(doc, "lc1", "h1");
    seedCompiled(store, "lc1", { hasPanel: false });
    const node = snapshotNode(store, nodeId) as never;

    renderSlot(store, <ComponentPanelHost nodes={[node]} />);
    expect(screen.getByText("Props")).toBeTruthy();
    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByText("count")).toBeTruthy();
  });

  test("multi-select of the SAME key edits all nodes; write is one undo entry", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedNode(doc, "lc1", "h1");
    const b = seedNode(doc, "lc1", "h1");
    seedCompiled(store, "lc1", { hasPanel: false });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    renderSlot(store, <ComponentPanelHost nodes={nodes} />);
    // The title row's text input; type + blur commits.
    const inputs = screen.getAllByRole("textbox");
    const titleInput = inputs[0]!;
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: "Shared" } });
    fireEvent.blur(titleInput);

    expect(undoDepth(store)).toBe(1);
    expect(storedTitle(doc, a)).toEqual({ type: "literal", value: { key: "string", value: "Shared" } });
    expect(storedTitle(doc, b)).toEqual({ type: "literal", value: { key: "string", value: "Shared" } });
  });

  test("mixed values across a multi-select do NOT show either node's value", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedNode(doc, "lc1", "h1", [
      { name: "title", value: { type: "literal", value: { key: "string", value: "AAA" } } },
    ]);
    const b = seedNode(doc, "lc1", "h1", [
      { name: "title", value: { type: "literal", value: { key: "string", value: "BBB" } } },
    ]);
    seedCompiled(store, "lc1", { hasPanel: false });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    renderSlot(store, <ComponentPanelHost nodes={nodes} />);
    // PropFieldRow detects the non-uniform binding and collapses to the fallback
    // default, so neither "AAA" nor "BBB" is shown (mixed is not either value).
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const titleInput = inputs[0]!;
    expect(titleInput.value).not.toBe("AAA");
    expect(titleInput.value).not.toBe("BBB");
  });

  test("reset removes the stored entry for all nodes in one undo entry", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedNode(doc, "lc1", "h1", [
      { name: "title", value: { type: "literal", value: { key: "string", value: "A" } } },
    ]);
    const b = seedNode(doc, "lc1", "h1", [
      { name: "title", value: { type: "literal", value: { key: "string", value: "A" } } },
    ]);
    seedCompiled(store, "lc1", { hasPanel: false });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    renderSlot(store, <ComponentPanelHost nodes={nodes} />);
    const resetButton = screen.getAllByTitle("Reset to default")[0]!;
    fireEvent.click(resetButton);

    expect(undoDepth(store)).toBe(1);
    expect(storedTitle(doc, a)).toBeUndefined();
    expect(storedTitle(doc, b)).toBeUndefined();
  });

  test("different-key multi-select renders nothing", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedNode(doc, "lc1", "h1");
    const b = seedNode(doc, "lc2", "h2");
    seedCompiled(store, "lc1", { hasPanel: false });
    seedCompiled(store, "lc2", { hasPanel: false });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    const { container } = renderSlot(store, <ComponentPanelHost nodes={nodes} />);
    expect(container.textContent).toBe("");
  });
});

// =============================================================================
// Builtin instances (registry-resolved manifest)
// =============================================================================

describe("ComponentPanelHost — builtin instances", () => {
  test("resolves the registry manifest so props are editable (not 'not in catalog')", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedBuiltinNode(doc, "sample-badge");
    const node = snapshotNode(store, nodeId) as never;

    renderSlot(store, <ComponentPanelHost nodes={[node]} />);
    // The sample-badge manifest declares a `label` prop (label "Label"); its row
    // renders, and the manifest-missing placeholder must NOT appear.
    expect(screen.getByText("Props")).toBeTruthy();
    expect(screen.getByText("Label")).toBeTruthy();
    expect(
      screen.queryByText(
        "This version is not in the project catalog, so its props can't be edited.",
      ),
    ).toBeNull();
  });

  test("an unknown builtin slug degrades to the manifest-missing placeholder", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedBuiltinNode(doc, "does-not-exist");
    const node = snapshotNode(store, nodeId) as never;

    renderSlot(store, <ComponentPanelHost nodes={[node]} />);
    expect(
      screen.getByText(
        "This version is not in the project catalog, so its props can't be edited.",
      ),
    ).toBeTruthy();
  });
});

// =============================================================================
// Custom session (FAKE transport)
// =============================================================================

/** A scripted fake transport that emits a fixed ready tree and records dispatches. */
function fakeTransport(tree: PanelTree) {
  let snapshot: PanelSnapshot = { status: "ready", tree, revision: 1 };
  const listeners = new Set<() => void>();
  const dispatched: PanelDispatchEvent[] = [];
  let restarted = 0;
  const transport: PanelTransport = {
    kind: "sandbox",
    update: () => {},
    dispatch: (event) => dispatched.push(event),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot: () => snapshot,
    restart: () => {
      restarted += 1;
      const revision =
        snapshot.status === "ready" ? snapshot.revision + 1 : 1;
      snapshot = { status: "ready", tree, revision };
      for (const cb of listeners) cb();
    },
    dispose: () => listeners.clear(),
  };
  const setSnapshot = (next: PanelSnapshot) => {
    snapshot = next;
    for (const cb of listeners) cb();
  };
  return { transport, dispatched, setSnapshot, restarted: () => restarted };
}

/** A minimal tree with a section + a propField(subtitle) so expandPropField fires. */
function customTree(): PanelTree {
  return {
    version: 1,
    root: {
      type: "panel",
      id: 0,
      props: {},
      events: [],
      children: [
        {
          type: "section",
          id: 1,
          props: { title: "Content" },
          events: [],
          children: [{ type: "propField", id: 2, props: { name: "title" }, events: [] }],
        },
      ],
    },
  } as unknown as PanelTree;
}

describe("ComponentPanelHost — custom session (fake transport)", () => {
  test("renders the custom tree and expands propField into a host row", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedNode(doc, "lc1", "h1");
    seedCompiled(store, "lc1", { hasPanel: true, code: "export default 1" });
    const node = snapshotNode(store, nodeId) as never;

    const fake = fakeTransport(customTree());
    renderSlot(
      store,
      <ComponentPanelHost createSandboxTransport={() => fake.transport} nodes={[node]} />,
    );

    // The section chrome renders, and the propField expanded into the host's
    // "title" prop row (label rendered by PropFieldRow).
    expect(screen.getByText("Content")).toBeTruthy();
    expect(screen.getByText("title")).toBeTruthy();
  });

  test("intents flow through the executor to a batched write with N targets → one undo entry", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedNode(doc, "lc1", "h1");
    const b = seedNode(doc, "lc1", "h1");
    seedCompiled(store, "lc1", { hasPanel: true, code: "export default 1" });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    let sink: ((raw: unknown) => void) | null = null;
    const fake = fakeTransport(customTree());
    renderSlot(
      store,
      <ComponentPanelHost
        createSandboxTransport={(opts) => {
          sink = opts.onIntents;
          return fake.transport;
        }}
        nodes={nodes}
      />,
    );

    // A committed set-prop reaches both selected nodes in one undo entry.
    sink!({ type: "set-prop", name: "title", value: "FromPanel", gesture: "commit" });

    expect(undoDepth(store)).toBe(1);
    expect(storedTitle(doc, a)).toEqual({
      type: "literal",
      value: { key: "string", value: "FromPanel" },
    });
    expect(storedTitle(doc, b)).toEqual({
      type: "literal",
      value: { key: "string", value: "FromPanel" },
    });
  });

  test("a fatal transport error falls back to the default panel with Retry", () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedNode(doc, "lc1", "h1");
    seedCompiled(store, "lc1", { hasPanel: true, code: "export default 1" });
    const node = snapshotNode(store, nodeId) as never;

    let fatal: ((message: string) => void) | null = null;
    const fake = fakeTransport(customTree());
    renderSlot(
      store,
      <ComponentPanelHost
        createSandboxTransport={(opts) => {
          fatal = opts.onFatal ?? null;
          return fake.transport;
        }}
        nodes={[node]}
      />,
    );

    // Trigger the fatal path; the slot swaps to the default panel + Retry.
    act(() => {
      fatal!("boom");
    });

    // The default panel + retry banner appear.
    expect(screen.getByText("Custom panel failed — showing default controls")).toBeTruthy();
    const retry = screen.getByText("Retry");
    fireEvent.click(retry);
    expect(fake.restarted()).toBe(1);
  });
});

// =============================================================================
// Catalog custom panel (async panel.js fetch → slot upgrade)
// =============================================================================

describe("ComponentPanelHost — catalog custom panel (async fetch)", () => {
  test("fetched panel code upgrades the default panel to a custom session", async () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedCatalogNode(doc, "cat1");
    seedCatalog(store, "cat1", { hasPanel: true });
    const node = snapshotNode(store, nodeId) as never;

    const fake = fakeTransport(customTree());
    // The fetch resolves on a later microtask, so the default panel renders first.
    renderSlot(
      store,
      <ComponentPanelHost
        createSandboxTransport={() => fake.transport}
        fetchPanelCode={() => Effect.runPromise(Effect.succeed("export default 1"))}
        nodes={[node]}
      />,
    );

    // Default panel is up immediately (the fetch has not resolved yet).
    expect(screen.getByText("Props")).toBeTruthy();

    // Once panel.js resolves, the slot swaps to the custom session (the section
    // chrome + expanded propField appear).
    expect(await screen.findByText("Content")).toBeTruthy();
    expect(screen.getByText("title")).toBeTruthy();
  });

  test("a soft fetch failure stays on the default panel (no error banner)", async () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedCatalogNode(doc, "cat1");
    seedCatalog(store, "cat1", { hasPanel: true });
    const node = snapshotNode(store, nodeId) as never;

    renderSlot(
      store,
      <ComponentPanelHost fetchPanelCode={() => Effect.runPromise(Effect.succeed(null))} nodes={[node]} />,
    );

    // The fetch resolves null; the slot remains the default panel and never shows
    // the crashed-session banner.
    await waitFor(() => expect(screen.getByText("Props")).toBeTruthy());
    expect(screen.queryByText("Custom panel failed — showing default controls")).toBeNull();
    expect(screen.getByText("title")).toBeTruthy();
  });

  test("no fetch is attempted when the catalog version has no panel", async () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const nodeId = seedCatalogNode(doc, "cat1");
    seedCatalog(store, "cat1", { hasPanel: false });
    const node = snapshotNode(store, nodeId) as never;

    let calls = 0;
    renderSlot(
      store,
      <ComponentPanelHost
        fetchPanelCode={() => {
          calls += 1;
          return Effect.runPromise(Effect.succeed("export default 1"));
        }}
        nodes={[node]}
      />,
    );

    await waitFor(() => expect(screen.getByText("Props")).toBeTruthy());
    expect(calls).toBe(0);
  });

  test("a homogeneous multi-select drives ONE fetch for the shared session", async () => {
    const doc = createOfflineDesignerDocument();
    const store = makeStore(doc);
    const a = seedCatalogNode(doc, "cat1");
    const b = seedCatalogNode(doc, "cat1");
    seedCatalog(store, "cat1", { hasPanel: true });
    const nodes = [snapshotNode(store, a), snapshotNode(store, b)] as never[];

    let calls = 0;
    const fake = fakeTransport(customTree());
    renderSlot(
      store,
      <ComponentPanelHost
        createSandboxTransport={() => fake.transport}
        fetchPanelCode={() => {
          calls += 1;
          return Effect.runPromise(Effect.succeed("export default 1"));
        }}
        nodes={nodes}
      />,
    );

    // A batch of same-hash instances resolves to ONE identity → one fetch drives
    // the single shared custom session. (Per-hash module-cache dedupe across
    // separate mounts is covered by catalog-panel-code.test.ts.)
    expect(await screen.findByText("Content")).toBeTruthy();
    expect(calls).toBe(1);
  });
});
