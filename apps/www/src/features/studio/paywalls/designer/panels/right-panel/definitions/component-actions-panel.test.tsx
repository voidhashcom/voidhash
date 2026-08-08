// @vitest-environment jsdom

import type {
  ComponentAction,
  ComponentManifest,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentBoundAction } from "@voidhash/mimic-schema";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// The action editor's product payload editor reads router params; outside a
// route `useParams({strict:false})` returns `{}`.
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({}) }));

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import {
  removeComponentActionBinding,
  setComponentActionBinding,
} from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { ComponentActionsPanel } from "./component-actions-panel";
import {
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedCompiledComponent,
  seedComponentCatalog,
  seedComponentNode,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
const restore: (() => void)[] = [];
// oxlint-disable-next-line effect/noTestLifecycleHooks -- module-scoped fixture teardown: disposes the panel harness and unwinds the `watchAction` store patches between tests. Both are installed by synchronous React renders inside each `it`, outside any Effect scope, so there is no Scope for Effect.acquireRelease to attach a finalizer to.
afterEach(() => {
  while (restore.length) restore.pop()!();
  harness?.dispose();
  harness = undefined;
});

const CONTENT_HASH = "hash-actions-v1";

/** A manifest carrying the given named actions (each with the given payload fields). */
function manifestWithActions(
  actions: Record<string, readonly string[]>,
): ComponentManifest {
  const built: Record<string, ComponentAction> = {};
  for (const [name, fields] of Object.entries(actions)) {
    built[name] = {
      payload: Object.fromEntries(fields.map((f) => [f, { kind: "string" } as const])),
    };
  }
  return { manifestVersion: 2, props: {}, actions: built };
}

/** Mirrors a manifest into the catalog for a node pinned to CONTENT_HASH. */
function seedCatalogManifest(store: PanelHarness["store"], manifest: ComponentManifest) {
  seedComponentCatalog(store, {
    latest: {
      artifactBaseUrl: "https://example.test/card",
      contentHash: CONTENT_HASH,
      createdAt: new Date(0),
      hasPanel: false,
      manifest,
      previewStates: ["default"],
      slug: "card",
      version: 1,
    },
    latestVersion: 1,
    slug: "card",
    title: "Card",
  });
}

describe("ComponentActionsPanel — manifest resolution", () => {
  test("not in catalog → the muted explainer renders (no rows)", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    await flush();

    const text = findNodeByType(harness.tree().root, "text")!;
    expect(text.props.tone).toBe("muted");
    expect(String(text.props.content)).toContain("not in the project catalog");
    expect(findNodeByType(harness.tree().root, "actionEditorField")).toBeUndefined();
  });

  test("manifest present with ZERO actions → the panel renders nothing", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({}));
    await flush();

    expect(findNodeByType(harness.tree().root, "section")).toBeUndefined();
    expect(findNodeByType(harness.tree().root, "text")).toBeUndefined();
  });

  test("local component resolves its manifest from the compiled artifact", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "local-card",
      componentVersion: 0,
      contentHash: "",
      localComponentId: "local-1",
    });
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCompiledComponent(harness.store, "local-1", manifestWithActions({ onPress: [] }));
    await flush();

    // A row rendered (an action editor exists) → the local manifest resolved.
    const button = findNodesByType(harness.tree().root, "button").find((b) =>
      String(b.props.label).startsWith("onPress"),
    );
    expect(button).toBeDefined();
    expect(findNodeByType(harness.tree().root, "actionEditorField")).toBeDefined();
  });
});

describe("ComponentActionsPanel — rows + payloadFields", () => {
  test("a row renders the stored bound action and its type label; unbound → None", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      actionBindings: [{ action: { type: "close-paywall" }, name: "onPress" }],
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({ onPress: [], onDismiss: [] }));
    await flush();

    const labels = findNodesByType(harness.tree().root, "button").map((b) => b.props.label);
    // Stored close-paywall → its label; unbound onDismiss → None.
    expect(labels).toContain("onPress  Close paywall");
    expect(labels).toContain("onDismiss  None");

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    expect((editor.props.value as { type: string }).type).toBe("close-paywall");
  });

  test("payloadFields flow from the manifest action onto the wire node", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({ onPress: ["productId", "quantity"] }));
    await flush();

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    expect(editor.props.payloadFields).toEqual(["productId", "quantity"]);
  });
});

describe("ComponentActionsPanel — writes", () => {
  test("a non-none action SETS the binding via setComponentActionBinding", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(setComponentActionBinding as never, calls as never));
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({ onPress: [] }));
    await flush();

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    const action: ComponentBoundAction = { type: "close-paywall" };
    harness.dispatch(editor.id, "onChange", [action]);
    expect(calls.at(-1)!.params).toEqual({ action, actionName: "onPress", nodeId });
    // A direct undoable write adds exactly one undo entry.
    expect(harness.undoDepth()).toBe(1);
  });

  test("a none action REMOVES the binding only when a stored entry exists", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      actionBindings: [{ action: { type: "close-paywall" }, name: "onPress" }],
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    const removeCalls: ActionCall<Record<string, unknown>>[] = [];
    const setCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(removeComponentActionBinding as never, removeCalls as never));
    restore.push(watchAction(setComponentActionBinding as never, setCalls as never));
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({ onPress: [] }));
    await flush();

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    harness.dispatch(editor.id, "onChange", [{ type: "none" }]);
    expect(removeCalls.at(-1)!.params).toEqual({ actionName: "onPress", nodeId });
    expect(setCalls).toHaveLength(0);
  });

  test("a none action on an UNBOUND row removes nothing (no dispatch)", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: CONTENT_HASH,
    });
    const removeCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(removeComponentActionBinding as never, removeCalls as never));
    harness = mountPanelDefinition(ComponentActionsPanel, doc, { nodeIds: [nodeId] });
    seedCatalogManifest(harness.store, manifestWithActions({ onPress: [] }));
    await flush();

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    harness.dispatch(editor.id, "onChange", [{ type: "none" }]);
    expect(removeCalls).toHaveLength(0);
  });
});
