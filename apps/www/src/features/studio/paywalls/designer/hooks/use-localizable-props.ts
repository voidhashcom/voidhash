"use client";

import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { LocalizablePropDescriptor } from "@voidhash/mimic-schema";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useCallback } from "react";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { definitionForComponentPath } from "../state/utils/code-components";

/**
 * A localizable component prop descriptor extended with the manifest prop kind,
 * so the translation table can render string props as text cells and image
 * props as image cells. Assignable wherever a plain
 * {@link LocalizablePropDescriptor} is expected.
 */
export interface LocalizablePropInfo extends LocalizablePropDescriptor {
  readonly kind: "string" | "image";
}

/** Maps a component instance node to its localizable props with kind info. */
export type GetLocalizablePropInfos = (
  node: ComponentSnapshotNode,
) => readonly LocalizablePropInfo[];

/**
 * Enumerates a component node's literal-bound localizable string/image props
 * from its resolved manifest (catalog by contentHash, or local by componentPath
 * → compiled artifact) — the synchronous, store-state-backed lookup that lets
 * coverage and the translation table include component-prop slots.
 */
export function useGetLocalizableProps(): GetLocalizablePropInfos {
  const store = usePaywallDesignerStore();
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const compiled = useStore(store, (state) => state.codeComponents.compiled);

  return useCallback<GetLocalizablePropInfos>(
    (node) => {
      const state = store.getState();
      let manifest: ComponentManifest | undefined;
      if (node.data.componentSource === "local") {
        const definitionId = definitionForComponentPath(state, node.data.componentPath)?.id;
        manifest =
          definitionId !== undefined ? compiled[definitionId]?.artifact?.manifest : undefined;
      } else {
        manifest = byContentHash[node.data.contentHash]?.manifest;
      }
      if (manifest === undefined) {
        return [];
      }
      const descriptors: LocalizablePropInfo[] = [];
      for (const [propName, def] of Object.entries(manifest.props)) {
        if ((def.kind === "string" || def.kind === "image") && def.localizable === true) {
          descriptors.push({ kind: def.kind, label: def.label ?? propName, propName });
        }
      }
      return descriptors;
    },
    [store, byContentHash, compiled],
  );
}
