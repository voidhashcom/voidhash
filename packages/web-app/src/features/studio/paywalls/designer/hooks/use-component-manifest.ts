import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { getBuiltinComponent } from "@voidhash/paywall-builtins";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { definitionForComponentPath } from "../state/utils/code-components";

/**
 * Resolves the {@link ComponentManifest} for a component instance node from the
 * correct source: local (in-document) code components read their compiled
 * artifact manifest, resolved from the instance's `componentPath` → definition
 * → compiled entry; builtin components read their manifest from the static
 * registry by stable `componentSlug`; catalog components read the pinned version
 * by `contentHash`. Returns `undefined` when no manifest is available yet (local
 * component still compiling / its file missing, unknown builtin slug, or catalog
 * version not mirrored into the project).
 *
 * This is the shared resolution used by the Props and Actions sections; it
 * matches `useComponentNodeWarnings` and fixes the historical bug where local
 * component instances resolved catalog-only and reported "not in catalog".
 */
export function useComponentManifest(node: ComponentSnapshotNode): ComponentManifest | undefined {
  const store = usePaywallDesignerStore();
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const compiled = useStore(store, (state) => state.codeComponents.compiled);
  const definitionId = useStore(store, (state) =>
    node.data.componentSource === "local"
      ? definitionForComponentPath(state, node.data.componentPath)?.id
      : undefined,
  );

  if (node.data.componentSource === "local") {
    return definitionId !== undefined ? compiled[definitionId]?.artifact?.manifest : undefined;
  }
  if (node.data.componentSource === "builtin") {
    // The builtin manifest is the same §2 shape but declared in
    // @voidhash/paywalls/schema, whose scalar `default` fields widen to
    // `unknown`; panels only read it, so bridge the nominal divergence.
    return getBuiltinComponent(node.data.componentSlug)?.manifest as ComponentManifest | undefined;
  }
  return byContentHash[node.data.contentHash]?.manifest;
}
