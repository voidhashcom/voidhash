import { commander } from "../designer-commander";
import type { ComponentCatalogEntry, ComponentCatalogVersion } from "../designer-store-state";

export interface SetComponentCatalogComponentsParams {
  components: ComponentCatalogEntry[];
}

/**
 * Replaces the catalog component list (latest versions) and indexes their
 * details into `byContentHash`. Pinned versions already mirrored for open
 * documents are preserved.
 */
export const setComponentCatalogComponents = commander.action<SetComponentCatalogComponentsParams>(
  (ctx, params) => {
    const state = ctx.getState();
    const components: Record<string, ComponentCatalogEntry> = {};
    const byContentHash = { ...state.componentCatalog.byContentHash };
    for (const entry of params.components) {
      components[entry.slug] = entry;
      byContentHash[entry.latest.contentHash] = entry.latest;
    }
    ctx.setState({
      componentCatalog: { byContentHash, components },
    });
  },
);

export interface MergeComponentCatalogVersionsParams {
  versions: ComponentCatalogVersion[];
}

/**
 * Merges pinned version details (fetched for component nodes whose
 * contentHash is missing from the mirror) into `byContentHash`. No-ops when
 * every version is already mirrored so dependent selectors keep identity.
 */
export const mergeComponentCatalogVersions = commander.action<MergeComponentCatalogVersionsParams>(
  (ctx, params) => {
    const state = ctx.getState();
    const existing = state.componentCatalog.byContentHash;
    const missing = params.versions.filter((version) => !existing[version.contentHash]);
    if (missing.length === 0) {
      return;
    }
    const byContentHash = { ...existing };
    for (const version of missing) {
      byContentHash[version.contentHash] = version;
    }
    ctx.setState({
      componentCatalog: { ...state.componentCatalog, byContentHash },
    });
  },
);
