import { getBuiltinComponent } from "@voidhash/paywall-builtins";
import { mountBuiltinPreview } from "@voidhash/paywall-renderer-preact";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "zustand/react";

import { PreviewTreeRenderer } from "../../components/component-preview/preview-tree-renderer";
import { useComponentPreviewTree } from "../../components/component-preview/use-preview-tree";
import { useComponentNodeWarnings } from "../../hooks/use-component-node-warnings";
import { usePaywallDesignerStore } from "../../state/designer-store";
import type { LocalComponentArtifact } from "../../state/designer-store-state";
import { definitionForComponentPath } from "../../state/utils/code-components";
import { Selectable } from "../helpers/selectable";

/**
 * Resolves the preview state to render from the spec §6 fallback chain: each
 * candidate (local override → persisted `previewState` → `"default"`) must be
 * listed in the catalog's `previewStates` to win; when none are, the first
 * available state is used. Returns undefined only when the catalog lists no
 * states at all.
 */
function resolvePreviewState(
  previewStates: readonly string[],
  candidates: ReadonlyArray<string | undefined>,
): string | undefined {
  for (const candidate of candidates) {
    if (candidate !== undefined && previewStates.includes(candidate)) {
      return candidate;
    }
  }
  return previewStates[0];
}

function PlaceholderChip({ label }: { label: string }) {
  return (
    <div className="inline-flex max-w-full items-center self-start truncate rounded-sm border border-border border-dashed bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {label}
    </div>
  );
}

function ComponentPreviewContent({
  artifactBaseUrl,
  contentHash,
  state,
  renderSlot,
}: {
  artifactBaseUrl: string;
  contentHash: string;
  state: string;
  renderSlot: () => ReactNode;
}) {
  const query = useComponentPreviewTree({ artifactBaseUrl, contentHash, state });

  if (query.isPending) {
    return <div className="min-h-12 min-w-24 animate-pulse rounded-sm bg-muted/60" />;
  }
  if (query.data === undefined) {
    return <PlaceholderChip label={`Component preview "${state}" failed to load`} />;
  }
  return <PreviewTreeRenderer renderSlot={renderSlot} tree={query.data} />;
}

/**
 * Renders a LOCAL component instance from its in-browser compiled artifact
 * (kept in the store, keyed by the definition id) — the same trusted
 * `PreviewTreeRenderer`, so slot mounting and affordances match the catalog
 * path exactly.
 */
function LocalComponentPreviewContent({
  artifact,
  candidates,
  renderSlot,
}: {
  artifact: LocalComponentArtifact;
  candidates: ReadonlyArray<string | undefined>;
  renderSlot: () => ReactNode;
}) {
  const states = Object.keys(artifact.previewTrees);
  const state = resolvePreviewState(states, candidates);
  const tree = state !== undefined ? artifact.previewTrees[state] : undefined;
  if (tree === undefined) {
    return <PlaceholderChip label="Component has no preview state" />;
  }
  return <PreviewTreeRenderer renderSlot={renderSlot} tree={tree} />;
}

/**
 * Renders a BUILTIN component instance by mounting the renderer's REAL preact
 * implementation as a small island inside the React canvas (the same package
 * whose sources already compile into this app for preview mode). Literal
 * document props resolve like production; variable references are inert on
 * the edit canvas, as are `actionBindings`. Builtins take no slot content
 * yet, so the node's editor children are not mounted inside the island. A
 * slug missing from the registry degrades to a labeled placeholder chip.
 */
function BuiltinComponentContent({ node }: { node: ComponentSnapshotNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slug = node.data.componentSlug;
  const props = node.data.props;
  const definition = getBuiltinComponent(slug);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || definition === undefined) {
      return;
    }
    return mountBuiltinPreview(container, { slug, props });
  }, [definition, slug, props]);

  if (definition === undefined) {
    return <PlaceholderChip label={`Built-in component "${slug}" not available`} />;
  }
  return <div ref={containerRef} />;
}

/**
 * Canvas renderer for `component` document nodes: renders the pinned preview
 * tree (trusted artifact) with the node's editor children mounted at the
 * tree's slot marker — or, for `componentSource: "builtin"`, the renderer's
 * real implementation as a preact island. Only the root element is selectable/registered for
 * bounding boxes — preview-tree internals are inert, while slotted children
 * are real editor nodes with full affordances. An amber badge surfaces §7.4
 * validation warnings.
 */
export function ComponentNodeRenderer({
  node,
  children,
  ref,
}: {
  node: ComponentSnapshotNode;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  const store = usePaywallDesignerStore();
  const isLocal = node.data.componentSource === "local";
  const isBuiltin = node.data.componentSource === "builtin";
  const catalogEntry = useStore(
    store,
    (state) => state.componentCatalog.byContentHash[node.data.contentHash],
  );
  const localDefinitionId = useStore(store, (state) =>
    isLocal ? definitionForComponentPath(state, node.data.componentPath)?.id : undefined,
  );
  const localArtifact = useStore(store, (state) =>
    localDefinitionId !== undefined
      ? state.codeComponents.compiled[localDefinitionId]?.artifact
      : undefined,
  );
  const localStatus = useStore(store, (state) =>
    localDefinitionId !== undefined
      ? state.codeComponents.compiled[localDefinitionId]?.status
      : undefined,
  );
  const localDefinitionExists = localDefinitionId !== undefined;
  const localPreviewState = useStore(
    store,
    (state) => state.componentPreviewStateSelection[node.id],
  );
  const warnings = useComponentNodeWarnings(node.id);
  const hasWarning = warnings.some((warning) => warning.severity === "warning");

  const previewState =
    !isLocal && catalogEntry
      ? resolvePreviewState(catalogEntry.previewStates, [
          localPreviewState,
          node.data.previewState,
          "default",
        ])
      : undefined;

  const stateCandidates = [localPreviewState, node.data.previewState, "default"];

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => (
        <div className="relative" ref={ref} {...selectableProps}>
          {isBuiltin ? (
            <BuiltinComponentContent node={node} />
          ) : isLocal ? (
            localArtifact !== undefined ? (
              <LocalComponentPreviewContent
                artifact={localArtifact}
                candidates={stateCandidates}
                renderSlot={() => children}
              />
            ) : !localDefinitionExists ? (
              <PlaceholderChip label={`Missing component file — ${node.data.componentPath}`} />
            ) : localStatus === "error" ? (
              <PlaceholderChip label={`Component file ${node.data.componentPath} has errors`} />
            ) : (
              <div className="min-h-12 min-w-24 animate-pulse rounded-sm bg-muted/60" />
            )
          ) : catalogEntry !== undefined && previewState !== undefined ? (
            <ComponentPreviewContent
              artifactBaseUrl={catalogEntry.artifactBaseUrl}
              contentHash={node.data.contentHash}
              renderSlot={() => children}
              state={previewState}
            />
          ) : (
            <PlaceholderChip label={`Component "${node.data.componentSlug}" not in catalog`} />
          )}
          {hasWarning && (
            <span
              className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex size-3.5 items-center justify-center [&_svg]:size-3"
              title="This component has validation warnings"
            >
              <TriangleAlertIcon className="fill-background text-amber-500" />
            </span>
          )}
        </div>
      )}
    </Selectable>
  );
}
