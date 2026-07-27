"use client";

import { useQueries } from "@tanstack/react-query";
import {
  renderPaywallToHtml,
  type ComponentArtifacts,
} from "@voidhash/paywall-renderer-preact";
import type { PreviewTree, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Phone } from "@voidhash/ui";
import { useCallback, useMemo } from "react";
import { useStore } from "zustand/react";

import {
  componentPreviewTreeOptions,
  type ComponentPreviewTreeOptions,
} from "../components/component-preview/use-preview-tree";
import { CANVAS_DEFAULTS } from "../constants";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { usePaywallDesignerStore } from "../state/designer-store";
import type {
  CodeComponentCompiled,
  ComponentCatalogByContentHash,
} from "../state/designer-store-state";
import { codeComponentDefinitions, selectCodeComponentNodes } from "../state/utils/code-components";
import { selectRenderRoot } from "../state/utils/document-root";

/**
 * Persisted-state fallback chain for preview mode (spec §8): the document's
 * `previewState` → `"default"` → first catalog state. Local editor overrides
 * are intentionally ignored — the preview reflects the document.
 */
function resolvePersistedPreviewState(
  previewStates: readonly string[],
  previewState: string,
): string | undefined {
  for (const candidate of [previewState, "default"]) {
    if (previewStates.includes(candidate)) {
      return candidate;
    }
  }
  return previewStates[0];
}

/**
 * Walks the preview snapshot for component nodes and resolves one preview-tree
 * fetch request per (contentHash, state) against the catalog mirror. Nodes
 * whose contentHash is not mirrored are skipped — they render the renderer's
 * built-in placeholder.
 */
function collectComponentTreeRequests(
  snapshot: SnapshotNode,
  byContentHash: ComponentCatalogByContentHash,
): ComponentPreviewTreeOptions[] {
  const requests: ComponentPreviewTreeOptions[] = [];
  const seen = new Set<string>();

  const visit = (node: SnapshotNode): void => {
    if (node.type === "component") {
      const entry = byContentHash[node.data.contentHash];
      if (entry) {
        const state = resolvePersistedPreviewState(entry.previewStates, node.data.previewState);
        const key = state === undefined ? undefined : `${node.data.contentHash}/${state}`;
        if (key !== undefined && state !== undefined && !seen.has(key)) {
          seen.add(key);
          requests.push({
            artifactBaseUrl: entry.artifactBaseUrl,
            contentHash: node.data.contentHash,
            state,
          });
        }
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };

  visit(snapshot);
  return requests;
}

/**
 * Walks the preview snapshot for local (in-document) code-component instances
 * and maps each referenced `componentPath` to its in-browser compiled preview
 * trees, resolving path → definition id → compiled artifact via `idByPath`.
 * Instances whose definition file is missing or has not compiled to a ready
 * artifact are skipped — the renderer shows its built-in placeholder for those.
 * Returns undefined when no local component resolves, keeping the embedded
 * hydration payload minimal.
 */
function collectLocalComponentTrees(
  snapshot: SnapshotNode,
  compiled: Record<string, CodeComponentCompiled>,
  idByPath: ReadonlyMap<string, string>,
): ComponentArtifacts["localTrees"] {
  const localTrees: Record<string, Record<string, PreviewTree>> = {};

  const visit = (node: SnapshotNode): void => {
    if (
      node.type === "component" &&
      node.data.componentSource === "local" &&
      node.data.componentPath !== "" &&
      !(node.data.componentPath in localTrees)
    ) {
      const definitionId = idByPath.get(node.data.componentPath);
      const artifact = definitionId !== undefined ? compiled[definitionId]?.artifact : undefined;
      if (artifact) {
        localTrees[node.data.componentPath] = artifact.previewTrees;
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };

  visit(snapshot);
  return Object.keys(localTrees).length === 0 ? undefined : localTrees;
}

export function PreviewCanvas() {
  const store = usePaywallDesignerStore();
  // Derive the preview snapshot reactively from the same draft-aware render root
  // the design canvas uses (`selectRenderRoot`), so the preview reflects the
  // current document live — committed edits (and in-progress drafts) reach the
  // iframe without a manual refresh. Reading a snapshot captured once on preview
  // entry left the phone frame frozen on the pre-edit document (e.g. a solid
  // background after the user switched it to a gradient).
  const previewSnapshot = useStore(store, selectRenderRoot);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const previewScale = useStore(store, (state) => state.previewScale);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const compiledCodeComponents = useStore(store, (state) => state.codeComponents.compiled);
  const codeNodes = useStore(store, selectCodeComponentNodes);

  const treeRequests = useMemo(
    () => collectComponentTreeRequests(previewSnapshot, byContentHash),
    [previewSnapshot, byContentHash],
  );

  // Trees still loading or failed are simply absent from the artifacts — the
  // renderer shows a labeled placeholder for those nodes instead of throwing.
  const combineLoadedTrees = useCallback(
    (results: Array<{ data: PreviewTree | undefined }>): ComponentArtifacts => {
      const trees: ComponentArtifacts["trees"] = {};
      results.forEach((result, index) => {
        const request = treeRequests[index];
        if (!request || result.data === undefined) {
          return;
        }
        (trees[request.contentHash] ??= {})[request.state] = result.data;
      });
      return { trees };
    },
    [treeRequests],
  );

  const catalogArtifacts = useQueries({
    combine: combineLoadedTrees,
    queries: treeRequests.map((request) => componentPreviewTreeOptions(request)),
  });

  // Local code components are not in the catalog and pin a sentinel
  // `contentHash: ""`, so their in-browser compiled trees are threaded through
  // `localTrees` (keyed by `componentPath`) alongside the catalog trees.
  const idByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const definition of codeComponentDefinitions(codeNodes)) {
      map.set(definition.path, definition.id);
    }
    return map;
  }, [codeNodes]);
  const localTrees = useMemo(
    () => collectLocalComponentTrees(previewSnapshot, compiledCodeComponents, idByPath),
    [previewSnapshot, compiledCodeComponents, idByPath],
  );

  const componentArtifacts = useMemo<ComponentArtifacts>(
    () => ({ trees: catalogArtifacts.trees, localTrees }),
    [catalogArtifacts, localTrees],
  );

  const html = useMemo(
    () =>
      renderPaywallToHtml(previewSnapshot, {
        componentArtifacts,
        hydrate: true,
        locale: activeLocale ?? undefined,
      }).html,
    [previewSnapshot, componentArtifacts, activeLocale],
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: CANVAS_DEFAULTS.BACKGROUND_COLOR,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
      }}
    >
      {/* Phone mockup container - maintains aspect ratio and scales to fit */}
      <div className="relative flex h-full w-full items-center justify-center p-8">
        {/* 832px of device height renders the screen at exactly 375x812 */}
        <Phone
          className="max-h-[832px] drop-shadow-2xl"
          fitHeight
          screenClassName="bg-white"
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: "center center",
          }}
        >
          {/* sandbox without allow-same-origin keeps the srcdoc document on an
              opaque origin: the hydration runtime only reads its embedded JSON
              and posts paywall:* messages to the parent, both of which
              allow-scripts permits. */}
          <iframe
            className="size-full bg-white"
            sandbox="allow-scripts"
            srcDoc={html}
            title="Paywall Preview"
          />
        </Phone>
      </div>
    </div>
  );
}
