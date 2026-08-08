"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { useEffect, useMemo } from "react";
import { useStore } from "zustand/react";
import { ComponentManifestSchema } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { useAuth } from "@/features/studio/components/auth-context";
import {
  getPaywallComponentVersionsOptions,
  listPaywallComponentsOptions,
} from "@/features/studio/lib/tanstack-query/paywall-components";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import {
  mergeComponentCatalogVersions,
  setComponentCatalogComponents,
} from "../state/actions/component-catalog-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import type { ComponentCatalogEntry, ComponentCatalogVersion } from "../state/designer-store-state";
import { selectDocumentRoot } from "../state/utils/document-root";

const decodeManifest = Schema.decodeUnknownSync(ComponentManifestSchema);

interface RawVersionDetail {
  slug: string;
  version: number;
  contentHash: string;
  manifest: unknown;
  hasPanel: boolean;
  previewStates: readonly string[];
  artifactBaseUrl: string;
  createdAt: Date;
}

function decodeVersionDetail(raw: RawVersionDetail): ComponentCatalogVersion | null {
  return Effect.runSync(
    Effect.try({
      try: (): ComponentCatalogVersion => ({
        artifactBaseUrl: raw.artifactBaseUrl,
        contentHash: raw.contentHash,
        createdAt: raw.createdAt,
        hasPanel: raw.hasPanel,
        manifest: decodeManifest(raw.manifest),
        previewStates: raw.previewStates,
        slug: raw.slug,
        version: raw.version,
      }),
      catch: (error) => error,
    }).pipe(
      Effect.catch((error) =>
        Effect.sync((): ComponentCatalogVersion | null => {
          console.warn(
            `[paywall-component-catalog] Skipping component "${raw.slug}"@${raw.version}: invalid manifest`,
            error,
          );
          return null;
        }),
      ),
    ),
  );
}

function collectMissingComponentRefs(
  root: SnapshotNode,
  knownContentHashes: ReadonlySet<string>,
): Array<{ slug: string; version: number }> {
  const refs: Array<{ slug: string; version: number }> = [];
  const seen = new Set<string>();

  const walk = (node: SnapshotNode): void => {
    if (
      node.type === "component" &&
      node.data.componentSource !== "local" &&
      !knownContentHashes.has(node.data.contentHash)
    ) {
      const key = `${node.data.componentSlug}@${node.data.componentVersion}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ slug: node.data.componentSlug, version: node.data.componentVersion });
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  walk(root);
  return refs;
}

/**
 * Mirrors the project's component catalog into the designer store for
 * synchronous gate/action/validation code. Mount once inside the designer:
 * fetches the latest-version list, decodes manifests (invalid entries are
 * skipped with a warning), and additionally batch-fetches pinned versions for
 * component nodes in the document whose contentHash is not mirrored yet.
 * Versions the backend does not know (silently omitted from the response)
 * stay absent — validation reports them as manifest-missing.
 */
export function usePaywallComponentCatalog(): void {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();

  const project = useMemo(() => {
    if (!organizationSlug || !projectSlug) return null;
    return CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug);
  }, [user, organizationSlug, projectSlug]);
  const projectId = project?.id;

  const { data: components } = useQuery({
    ...listPaywallComponentsOptions({ projectId: projectId ?? "" }),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!components) return;
    const decoded: ComponentCatalogEntry[] = [];
    for (const component of components) {
      const latest = decodeVersionDetail(component.latest);
      if (!latest) continue;
      decoded.push({
        latest,
        latestVersion: component.latestVersion,
        slug: component.slug,
        title: component.title,
      });
    }
    dispatch(setComponentCatalogComponents)({ components: decoded });
  }, [components, dispatch]);

  const documentRoot = useStore(store, selectDocumentRoot);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);

  const missingRefs = useMemo(
    () => collectMissingComponentRefs(documentRoot, new Set(Object.keys(byContentHash))),
    [documentRoot, byContentHash],
  );

  const { data: pinnedVersions } = useQuery({
    ...getPaywallComponentVersionsOptions({ projectId: projectId ?? "", refs: missingRefs }),
    enabled: !!projectId && missingRefs.length > 0,
  });

  useEffect(() => {
    if (!pinnedVersions) return;
    const decoded = pinnedVersions
      .map(decodeVersionDetail)
      .filter((version): version is ComponentCatalogVersion => version !== null);
    if (decoded.length === 0) return;
    dispatch(mergeComponentCatalogVersions)({ versions: decoded });
  }, [pinnedVersions, dispatch]);
}
