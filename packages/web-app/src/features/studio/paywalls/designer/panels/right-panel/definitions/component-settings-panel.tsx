"use client";

/**
 * Built-in panel definition for component identity, version, and preview state.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Component" → `Panel.Section title="Component"`.
 * - A Name rename `TextInput` → `Panel.Field label="Name"` > `Panel.TextField`
 *   (writes on `onChange`, like the old section's `onChange={handleNameChange}`).
 * - Read-only Component slug + Version rows → `Panel.Field` > `Panel.Text` rows;
 *   when a newer catalog version exists the version row also shows a muted
 *   "vN available" note.
 * - An "Update to vN" `Panel.Button` (visible ONLY when `updatePlan` exists).
 * - When the pinned version has >1 preview state, a `Panel.Subsection "Preview
 *   state"` with a "Set as default" ghost button (visible only when the effective
 *   selection differs from the persisted default) and a `Panel.Column` of
 *   selectable `Panel.Button`s (accent `default` variant for the effective state,
 *   `ghost` otherwise; the persisted default is labelled "· default").
 *
 * The version-update AlertDialog is NOT rendered inline: clicking "Update"
 * awaits `usePanelHostServices().confirmComponentUpdate(plan)`; the HOST renders
 * the confirm dialog ({@link ../panel-host-services-host.PanelHostServicesHost})
 * from the plan's `title` + `details` lines — which carry the same content the
 * old inline dialog rendered (intro, removed-props, reset-preview, warning
 * messages, or the "All configured props and actions carry over." fallback).
 *
 * Behavior (identical to the old section):
 * - `effectivePreviewState = componentPreviewStateSelection[node.id] ?? persisted`.
 *   Selecting a state writes the EPHEMERAL `setComponentPreviewStateSelection`
 *   (null when re-selecting the persisted default); "Set as default" PERSISTS via
 *   `updateComponentNode({previewState})` then clears the ephemeral selection.
 * - `updatePlan` (a `useMemo`) compares `catalogEntry.latest` vs
 *   `node.data.componentVersion`; runs `validateComponentNode` against the latest
 *   manifest to derive `removedPropNames` (unknown-prop warnings), remaining
 *   `warningMessages`, and `resetPreviewState`.
 * - Confirm=true → `applyComponentVersionUpdate({...})` THEN
 *   `setComponentPreviewStateSelection(null)` (exact old ordering); confirm=false
 *   → nothing dispatched.
 */
import { getBuiltinComponent } from "@voidhash/paywall-builtins";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useMemo } from "react";
import { useStore } from "zustand/react";

import type { ComponentUpdatePlan } from "../../../panel-runtime/panel-host-services";
import { usePanelHostServices } from "../../../panel-runtime/panel-host-services";
import {
  applyComponentVersionUpdate,
  setComponentPreviewStateSelection,
  updateComponentNode,
} from "../../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../../state/designer-store";
import type { ComponentCatalogVersion } from "../../../state/designer-store-state";
import type { AncestorVariablesSnapshotNode } from "../../../state/utils/ancestor-variables";
import { componentFileName } from "../../../state/utils/code-components";
import {
  collectAncestorVariableIds,
  validateComponentNode,
} from "../../../state/utils/component-validation";
import { selectDocumentRoot } from "../../../state/utils/document-root";
import { useDefinitionNodes } from "./use-definition-nodes";

/** The derived plan for updating a component instance to the latest catalog version. */
interface VersionUpdatePlan {
  latest: ComponentCatalogVersion;
  latestVersion: number;
  /** Stored props the new manifest no longer declares — removed on confirm. */
  removedPropNames: string[];
  /** Remaining warning messages the update would introduce. */
  warningMessages: string[];
  resetPreviewState: boolean;
}

/** The `Component settings` panel definition. */
export function ComponentSettingsPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const services = usePanelHostServices();
  const { nodes } = useDefinitionNodes();

  const node = nodes[0] as ComponentSnapshotNode | undefined;
  const nodeId = node?.id ?? "";

  const components = useStore(store, (state) => state.componentCatalog.components);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const previewStateSelection = useStore(
    store,
    (state) => state.componentPreviewStateSelection[nodeId],
  );
  const documentRoot: AncestorVariablesSnapshotNode = useStore(store, selectDocumentRoot);

  const isLocal = node?.data.componentSource === "local";
  const isBuiltin = node?.data.componentSource === "builtin";
  // Builtins carry no catalog row and no pinned hash — they resolve from the
  // static registry by slug; catalog affordances (version/update) never apply.
  const builtin = isBuiltin && node ? getBuiltinComponent(node.data.componentSlug) : undefined;
  const catalogEntry = node && !isBuiltin ? components[node.data.componentSlug] : undefined;
  const pinnedVersion = node && !isBuiltin ? byContentHash[node.data.contentHash] : undefined;
  const previewStates = isBuiltin
    ? (builtin?.manifest.previewStates ?? [])
    : (pinnedVersion?.previewStates ?? []);
  const componentLabel =
    node === undefined
      ? ""
      : isLocal
        ? componentFileName(node.data.componentPath)
        : isBuiltin
          ? (builtin?.name ?? node.data.componentSlug)
          : node.data.componentSlug;

  const persistedPreviewState = node?.data.previewState ?? "default";
  const effectivePreviewState = previewStateSelection ?? persistedPreviewState;

  const updatePlan = useMemo((): VersionUpdatePlan | null => {
    if (!node || !catalogEntry || catalogEntry.latestVersion <= node.data.componentVersion) {
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

  if (!node) return <Panel />;

  const handleNameChange = (name: string) => {
    dispatch(updateComponentNode)({ id: node.id, updates: { name } });
  };

  const handleSelectPreviewState = (state: string) => {
    dispatch(setComponentPreviewStateSelection)({
      nodeId,
      previewState: state === persistedPreviewState ? null : state,
    });
  };

  const handlePersistPreviewState = () => {
    dispatch(updateComponentNode)({
      id: node.id,
      updates: { previewState: effectivePreviewState },
    });
    dispatch(setComponentPreviewStateSelection)({ nodeId, previewState: null });
  };

  /**
   * Builds the host confirm-dialog plan carrying every line the old inline
   * AlertDialog rendered (intro + removed-props + reset-preview + warnings, or
   * the "all carry over" fallback), so the host dialog is content-identical.
   */
  const buildConfirmPlan = (plan: VersionUpdatePlan): ComponentUpdatePlan => {
    const details: string[] = [
      `This instance is pinned to v${node.data.componentVersion}. Updating re-renders it from the latest deployed version.`,
    ];
    if (plan.removedPropNames.length > 0) {
      details.push(`Will be removed (no longer declared): ${plan.removedPropNames.join(", ")}`);
    }
    if (plan.resetPreviewState) {
      details.push(
        `The preview state "${persistedPreviewState}" no longer exists and resets to "default".`,
      );
    }
    for (const message of plan.warningMessages) {
      details.push(message);
    }
    if (
      plan.removedPropNames.length === 0 &&
      plan.warningMessages.length === 0 &&
      !plan.resetPreviewState
    ) {
      details.push("All configured props and actions carry over.");
    }
    return {
      confirmLabel: "Update",
      details,
      title: `Update ${catalogEntry?.title ?? node.data.componentSlug} to v${plan.latestVersion}`,
    };
  };

  const handleUpdate = async () => {
    if (!updatePlan) return;
    const confirmed = await services.confirmComponentUpdate(buildConfirmPlan(updatePlan));
    if (!confirmed) return;
    dispatch(applyComponentVersionUpdate)({
      contentHash: updatePlan.latest.contentHash,
      dropPropNames: updatePlan.removedPropNames,
      nodeId,
      resetPreviewState: updatePlan.resetPreviewState,
      version: updatePlan.latestVersion,
    });
    dispatch(setComponentPreviewStateSelection)({ nodeId, previewState: null });
  };

  return (
    <Panel>
      <Panel.Section title="Component">
        <Panel.Column gap="sm">
          <Panel.Field label="Name">
            <Panel.TextField kind="text" value={node.data.name ?? ""} onChange={handleNameChange} />
          </Panel.Field>
          <Panel.Field label="Component">
            <Panel.Text content={componentLabel} />
          </Panel.Field>
          {!isLocal && !isBuiltin && (
            <Panel.Field label="Version">
              <Panel.Row gap="sm" align="center">
                <Panel.Text content={`v${node.data.componentVersion}`} />
                {updatePlan && (
                  <Panel.Text tone="muted" content={`v${updatePlan.latestVersion} available`} />
                )}
              </Panel.Row>
            </Panel.Field>
          )}
        </Panel.Column>

        {updatePlan && (
          <Panel.Button
            label={`Update to v${updatePlan.latestVersion}`}
            icon="arrowUpCircle"
            variant="outline"
            size="default"
            onClick={handleUpdate}
          />
        )}

        {previewStates.length > 1 && (
          <Panel.Subsection title="Preview state">
            {effectivePreviewState !== persistedPreviewState && (
              <Panel.Button
                label="Set as default"
                variant="ghost"
                size="sm"
                onClick={handlePersistPreviewState}
              />
            )}
            <Panel.Column gap="none">
              {previewStates.map((state) => (
                <Panel.Button
                  key={state}
                  label={state === persistedPreviewState ? `${state}  · default` : state}
                  size="sm"
                  variant={effectivePreviewState === state ? "default" : "ghost"}
                  onClick={() => handleSelectPreviewState(state)}
                />
              ))}
            </Panel.Column>
          </Panel.Subsection>
        )}
      </Panel.Section>
    </Panel>
  );
}
