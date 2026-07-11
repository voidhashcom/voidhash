"use client";

import { getBuiltinComponent } from "@voidhash/paywall-builtins";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
} from "@voidhash/ui";
import { ArrowUpCircleIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { TextInput } from "@/features/studio/paywalls/designer/components/ui/text-input";
import {
  applyComponentVersionUpdate,
  setComponentPreviewStateSelection,
  updateComponentNode,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import type { ComponentCatalogVersion } from "@/features/studio/paywalls/designer/state/designer-store-state";
import type { AncestorVariablesSnapshotNode } from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import {
  collectAncestorVariableIds,
  validateComponentNode,
} from "@/features/studio/paywalls/designer/state/utils/component-validation";
import { componentFileName } from "@/features/studio/paywalls/designer/state/utils/code-components";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";

interface VersionUpdatePlan {
  latest: ComponentCatalogVersion;
  latestVersion: number;
  /** Stored props the new manifest no longer declares — removed on confirm. */
  removedPropNames: string[];
  /** Remaining warning messages the update would introduce. */
  warningMessages: string[];
  resetPreviewState: boolean;
}

export interface ComponentSectionProps {
  node: ComponentSnapshotNode;
}

export function ComponentSection({ node }: ComponentSectionProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const components = useStore(store, (state) => state.componentCatalog.components);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const previewStateSelection = useStore(
    store,
    (state) => state.componentPreviewStateSelection[node.id],
  );
  const documentRoot: AncestorVariablesSnapshotNode = useStore(store, selectDocumentRoot);

  const isLocal = node.data.componentSource === "local";
  const isBuiltin = node.data.componentSource === "builtin";
  // Builtins carry no catalog row and no pinned hash — they resolve from the
  // static registry by slug; catalog affordances (version/update) never apply.
  const builtin = isBuiltin ? getBuiltinComponent(node.data.componentSlug) : undefined;
  const catalogEntry = isBuiltin ? undefined : components[node.data.componentSlug];
  const pinnedVersion = isBuiltin ? undefined : byContentHash[node.data.contentHash];
  const previewStates = isBuiltin
    ? (builtin?.manifest.previewStates ?? [])
    : (pinnedVersion?.previewStates ?? []);
  // The "Component" row shows the file basename for a local instance (its slug
  // sentinel is empty), the registry display name for a builtin, or the catalog
  // slug for a catalog instance.
  const componentLabel = isLocal
    ? componentFileName(node.data.componentPath)
    : isBuiltin
      ? (builtin?.name ?? node.data.componentSlug)
      : node.data.componentSlug;

  const persistedPreviewState = node.data.previewState ?? "default";
  const effectivePreviewState = previewStateSelection ?? persistedPreviewState;

  const updatePlan = useMemo((): VersionUpdatePlan | null => {
    if (!catalogEntry || catalogEntry.latestVersion <= node.data.componentVersion) {
      return null;
    }
    const latest = catalogEntry.latest;
    const availableVariableIds = collectAncestorVariableIds(documentRoot, node.id);
    const warnings = validateComponentNode(
      {
        actionBindings: node.data.actionBindings,
        children: node.children,
        contentHash: node.data.contentHash,
        props: node.data.props,
      },
      latest.manifest,
      availableVariableIds,
    );
    const removedPropNames = [
      ...new Set(
        warnings
          .filter((warning) => warning.kind === "unknown-prop")
          .map((warning) => warning.propName),
      ),
    ];
    const warningMessages = warnings
      .filter((warning) => warning.kind !== "unknown-prop" && warning.severity === "warning")
      .map((warning) => warning.message);
    return {
      latest,
      latestVersion: catalogEntry.latestVersion,
      removedPropNames,
      resetPreviewState: !latest.previewStates.includes(persistedPreviewState),
      warningMessages,
    };
  }, [catalogEntry, node, documentRoot, persistedPreviewState]);

  const handleNameChange = (name: string) => {
    dispatch(updateComponentNode)({ id: node.id, updates: { name } });
  };

  const handleSelectPreviewState = (state: string) => {
    dispatch(setComponentPreviewStateSelection)({
      nodeId: node.id,
      previewState: state === persistedPreviewState ? null : state,
    });
  };

  const handlePersistPreviewState = () => {
    dispatch(updateComponentNode)({
      id: node.id,
      updates: { previewState: effectivePreviewState },
    });
    dispatch(setComponentPreviewStateSelection)({ nodeId: node.id, previewState: null });
  };

  const handleConfirmUpdate = () => {
    if (!updatePlan) {
      return;
    }
    dispatch(applyComponentVersionUpdate)({
      contentHash: updatePlan.latest.contentHash,
      dropPropNames: updatePlan.removedPropNames,
      nodeId: node.id,
      resetPreviewState: updatePlan.resetPreviewState,
      version: updatePlan.latestVersion,
    });
    dispatch(setComponentPreviewStateSelection)({ nodeId: node.id, previewState: null });
    setIsUpdateDialogOpen(false);
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Component</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
            <span className="min-w-16 text-muted-foreground text-xs">Name</span>
            <TextInput
              className="flex-1"
              label="Name"
              onChange={handleNameChange}
              value={node.data.name ?? ""}
            />
          </div>
          <div className="flex flex-row items-center gap-2">
            <span className="min-w-16 text-muted-foreground text-xs">Component</span>
            <span className="truncate text-xs">{componentLabel}</span>
          </div>
          {!isLocal && !isBuiltin && (
            <div className="flex flex-row items-center gap-2">
              <span className="min-w-16 text-muted-foreground text-xs">Version</span>
              <span className="text-xs">v{node.data.componentVersion}</span>
              {updatePlan && (
                <span className="text-[10px] text-muted-foreground">
                  v{updatePlan.latestVersion} available
                </span>
              )}
            </div>
          )}
        </div>

        {updatePlan && (
          <Button
            className="w-full"
            onClick={() => setIsUpdateDialogOpen(true)}
            size="sm"
            variant="outline"
          >
            <ArrowUpCircleIcon />
            Update to v{updatePlan.latestVersion}
          </Button>
        )}

        {previewStates.length > 1 && (
          <PanelSubSection>
            <div className="flex h-7 flex-row items-center justify-between">
              <PanelSubSectionTitle>Preview state</PanelSubSectionTitle>
              {effectivePreviewState !== persistedPreviewState && (
                <Button onClick={handlePersistPreviewState} size="sm" variant="ghost">
                  Set as default
                </Button>
              )}
            </div>
            <PanelSubSectionContent>
              <div className="flex flex-col">
                {previewStates.map((state) => (
                  <button
                    className={cn(
                      "flex h-7 w-full items-center rounded-sm px-2 text-left font-medium text-xs",
                      effectivePreviewState === state
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                    key={state}
                    onClick={() => handleSelectPreviewState(state)}
                    type="button"
                  >
                    {state}
                    {state === persistedPreviewState && (
                      <span className="ml-auto text-[10px] text-muted-foreground">default</span>
                    )}
                  </button>
                ))}
              </div>
            </PanelSubSectionContent>
          </PanelSubSection>
        )}
      </PanelSectionContent>

      <AlertDialog onOpenChange={setIsUpdateDialogOpen} open={isUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Update {catalogEntry?.title ?? node.data.componentSlug} to v{updatePlan?.latestVersion}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This instance is pinned to v{node.data.componentVersion}. Updating re-renders it from
                  the latest deployed version.
                </p>
                {updatePlan && updatePlan.removedPropNames.length > 0 && (
                  <p className="text-amber-600 text-sm">
                    Will be removed (no longer declared): {updatePlan.removedPropNames.join(", ")}
                  </p>
                )}
                {updatePlan?.resetPreviewState && (
                  <p className="text-sm">
                    The preview state &quot;{persistedPreviewState}&quot; no longer exists and
                    resets to &quot;default&quot;.
                  </p>
                )}
                {updatePlan?.warningMessages.map((message) => (
                  <p className="text-amber-600 text-sm" key={message}>
                    {message}
                  </p>
                ))}
                {updatePlan &&
                  updatePlan.removedPropNames.length === 0 &&
                  updatePlan.warningMessages.length === 0 &&
                  !updatePlan.resetPreviewState && (
                    <p className="text-sm">All configured props and actions carry over.</p>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>Update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelSection>
  );
}
