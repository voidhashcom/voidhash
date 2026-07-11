// @vitest-environment jsdom

import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import {
  applyComponentVersionUpdate,
  setComponentPreviewStateSelection,
  updateComponentNode,
} from "../../../state/actions";
import type { ComponentCatalogVersion } from "../../../state/designer-store-state";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { ComponentSettingsPanel } from "./component-settings-panel";
import {
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedComponentCatalog,
  seedComponentNode,
  selectComponentPreviewState,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
const restore: (() => void)[] = [];
afterEach(() => {
  while (restore.length) restore.pop()!();
  harness?.dispose();
  harness = undefined;
});

const HASH_V1 = "hash-card-v1";
const HASH_V2 = "hash-card-v2";

const EMPTY_MANIFEST: ComponentManifest = { manifestVersion: 2, props: {} };

/** A catalog version detail keyed by its contentHash + version + preview states. */
function version(
  contentHash: string,
  v: number,
  previewStates: readonly string[],
  manifest: ComponentManifest = EMPTY_MANIFEST,
): ComponentCatalogVersion {
  return {
    artifactBaseUrl: "https://example.test/card",
    contentHash,
    createdAt: new Date(0),
    hasPanel: false,
    manifest,
    previewStates,
    slug: "card",
    version: v,
  };
}

/**
 * Seeds a single-version catalog (latest == v1, pinned at HASH_V1) with the given
 * preview states, so a node pinned to HASH_V1 resolves its preview states.
 */
function seedSingleVersionCatalog(store: PanelHarness["store"], previewStates: readonly string[]) {
  seedComponentCatalog(store, {
    latest: version(HASH_V1, 1, previewStates),
    latestVersion: 1,
    slug: "card",
    title: "Card",
  });
}

describe("ComponentSettingsPanel — display + rename", () => {
  test("renders the name field, component slug, and version label", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
      name: "Hero card",
    });
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    await flush();

    expect(findNodeByType(harness.tree().root, "section")?.props.title).toBe("Component");
    const nameField = findNodeByType(harness.tree().root, "textField")!;
    expect(nameField.props.value).toBe("Hero card");
    const texts = findNodesByType(harness.tree().root, "text").map((t) => t.props.content);
    expect(texts).toContain("card");
    expect(texts).toContain("v1");
  });

  test("editing the name writes updateComponentNode with the new name", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
      name: "Hero card",
    });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateComponentNode as never, calls as never));
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    await flush();

    const nameField = findNodeByType(harness.tree().root, "textField")!;
    harness.dispatch(nameField.id, "onChange", ["Renamed"]);
    expect(calls.at(-1)!.params).toEqual({ id: nodeId, updates: { name: "Renamed" } });
  });
});

describe("ComponentSettingsPanel — builtin instance", () => {
  test("shows the registry display name and no catalog version/update affordance", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      builtin: true,
      componentSlug: "sample-badge",
      componentVersion: 0,
      contentHash: "",
      name: "Badge",
    });
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    await flush();

    const texts = findNodesByType(harness.tree().root, "text").map((t) => t.props.content);
    // The "Component" row shows the registry display name, not the raw slug.
    expect(texts).toContain("Sample Badge");
    expect(texts).not.toContain("sample-badge");
    // Builtins are unpinned — no version row (no `v…` text) leaks through.
    expect(texts.some((content) => /^v/.test(String(content)))).toBe(false);
    // No catalog-only update affordance.
    expect(
      findNodesByType(harness.tree().root, "button").some((b) =>
        String(b.props.label).startsWith("Update to"),
      ),
    ).toBe(false);
  });
});

describe("ComponentSettingsPanel — preview state", () => {
  test("no preview-state controls when the pinned version has ≤1 state", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
    });
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    seedSingleVersionCatalog(harness.store, ["default"]);
    await flush();

    expect(findNodeByType(harness.tree().root, "subsection")).toBeUndefined();
  });

  test("selecting a state writes the EPHEMERAL selection (no persist)", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
    });
    const selCalls: ActionCall<Record<string, unknown>>[] = [];
    const updateCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(setComponentPreviewStateSelection as never, selCalls as never));
    restore.push(watchAction(updateComponentNode as never, updateCalls as never));
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    seedSingleVersionCatalog(harness.store, ["default", "loading"]);
    await flush();

    const loading = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.label === "loading",
    )!;
    harness.dispatch(loading.id, "onClick");
    expect(selCalls.at(-1)!.params).toEqual({ nodeId, previewState: "loading" });
    // Selecting is ephemeral — no persist write.
    expect(updateCalls).toHaveLength(0);
  });

  test("Set as default appears only when differing and PERSISTS then clears the selection", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
    });
    const selCalls: ActionCall<Record<string, unknown>>[] = [];
    const updateCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(setComponentPreviewStateSelection as never, selCalls as never));
    restore.push(watchAction(updateComponentNode as never, updateCalls as never));
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    seedSingleVersionCatalog(harness.store, ["default", "loading"]);
    await flush();

    // No ephemeral selection yet → the effective state equals the default → no button.
    expect(
      findNodesByType(harness.tree().root, "button").some((b) => b.props.label === "Set as default"),
    ).toBe(false);

    // An ephemeral selection differing from the default reveals the button.
    act(() => selectComponentPreviewState(harness!.store, nodeId, "loading"));
    await flush();
    const setDefault = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.label === "Set as default",
    )!;
    expect(setDefault).toBeDefined();

    harness.dispatch(setDefault.id, "onClick");
    expect(updateCalls.at(-1)!.params).toEqual({ id: nodeId, updates: { previewState: "loading" } });
    // …then clears the ephemeral selection to null.
    expect(selCalls.at(-1)!.params).toEqual({ nodeId, previewState: null });
  });
});

describe("ComponentSettingsPanel — version update", () => {
  /**
   * Seeds a two-version catalog: node pinned at v1 (HASH_V1, prop "oldProp"),
   * latest at v2 (HASH_V2) whose manifest DROPS "oldProp" and whose preview
   * states drop the persisted "loading" → the plan carries removedPropNames +
   * resetPreviewState.
   */
  function seedUpgradeableCatalog(store: PanelHarness["store"]) {
    // Latest v2: no props declared, only "default" preview state.
    seedComponentCatalog(
      store,
      {
        latest: version(HASH_V2, 2, ["default"], EMPTY_MANIFEST),
        latestVersion: 2,
        slug: "card",
        title: "Card",
      },
      // Pinned v1 (>1 preview state so the persisted "loading" is valid at v1).
      [version(HASH_V1, 1, ["default", "loading"], EMPTY_MANIFEST)],
    );
  }

  test("no newer version → no update affordance", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
    });
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, { nodeIds: [nodeId] });
    seedSingleVersionCatalog(harness.store, ["default"]);
    await flush();

    expect(
      findNodesByType(harness.tree().root, "button").some((b) =>
        String(b.props.label).startsWith("Update to"),
      ),
    ).toBe(false);
  });

  test("newer version → the plan carries removedPropNames + resetPreviewState; confirm=true applies + clears selection", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
      previewState: "loading",
      props: [{ name: "oldProp", value: { type: "literal", value: { key: "string", value: "x" } } }],
    });
    const applyCalls: ActionCall<Record<string, unknown>>[] = [];
    const selCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(applyComponentVersionUpdate as never, applyCalls as never));
    restore.push(watchAction(setComponentPreviewStateSelection as never, selCalls as never));
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, {
      confirmResult: true,
      nodeIds: [nodeId],
    });
    seedUpgradeableCatalog(harness.store);
    await flush();

    const updateButton = findNodesByType(harness.tree().root, "button").find((b) =>
      String(b.props.label).startsWith("Update to"),
    )!;
    expect(updateButton.props.label).toBe("Update to v2");

    harness.dispatch(updateButton.id, "onClick");
    await flush();

    // The host confirm plan carried the removed prop + reset-preview lines.
    const plan = harness.hostLog.confirmComponentUpdate.at(-1)!;
    expect(plan.title).toBe("Update Card to v2");
    const details = plan.details ?? [];
    expect(details.some((line) => line.includes("oldProp"))).toBe(true);
    expect(details.some((line) => line.includes("loading") && line.includes("resets"))).toBe(true);

    // Confirm=true → apply with exact params, THEN clear the ephemeral selection.
    expect(applyCalls.at(-1)!.params).toEqual({
      contentHash: HASH_V2,
      dropPropNames: ["oldProp"],
      nodeId,
      resetPreviewState: true,
      version: 2,
    });
    expect(selCalls.at(-1)!.params).toEqual({ nodeId, previewState: null });
  });

  test("confirm=false → nothing is dispatched", async () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, {
      componentSlug: "card",
      componentVersion: 1,
      contentHash: HASH_V1,
      previewState: "loading",
      props: [{ name: "oldProp", value: { type: "literal", value: { key: "string", value: "x" } } }],
    });
    const applyCalls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(applyComponentVersionUpdate as never, applyCalls as never));
    harness = mountPanelDefinition(ComponentSettingsPanel, doc, {
      confirmResult: false,
      nodeIds: [nodeId],
    });
    seedUpgradeableCatalog(harness.store);
    await flush();

    const updateButton = findNodesByType(harness.tree().root, "button").find((b) =>
      String(b.props.label).startsWith("Update to"),
    )!;
    harness.dispatch(updateButton.id, "onClick");
    await flush();

    expect(harness.hostLog.confirmComponentUpdate).toHaveLength(1);
    expect(applyCalls).toHaveLength(0);
  });
});
