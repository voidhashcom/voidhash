"use client";

/**
 * Built-in panel definition for component action bindings.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Actions" → `Panel.Section title="Actions"`.
 * - Manifest missing (not in the project catalog) → a `Panel.Text` explainer
 *   exactly as the old section renders it. Manifest present with ZERO actions →
 *   the whole panel renders nothing (an empty `<Panel/>`), matching the old
 *   section's `return null`.
 * - One `Panel.Row` per manifest action: a controlled `Panel.Popover` (open when
 *   `openActionName === name`) over a trigger `Panel.Button` (the action name +
 *   its current bound-action-type label) and a `Panel.ActionEditorField` in the
 *   content.
 *
 * Manifest resolution is DUAL-SOURCE via {@link useComponentManifest} (local
 * compiled artifact OR pinned catalog version), fixing the old section's
 * catalog-only bug so local component instances resolve correctly.
 *
 * Behavior (identical to the old section):
 * - Each row's stored entry is `findComponentActionEntry(node.data.actionBindings,
 *   name)`, decoded via `componentBoundActionFromRaw`, defaulting to the
 *   `UNBOUND_ACTION` (`{type:"none"}`).
 * - The editor is passed `variables`/`productVariables` (product subset) AND
 *   `payloadFields = Object.keys(manifestAction.payload)` — unlike interactions,
 *   which never offer action-payload sources.
 * - `onChange`: a `none` action REMOVES the binding (via
 *   `removeComponentActionBinding`) but only when a stored entry exists; any other
 *   action SETS it via `setComponentActionBinding` — exact old branching.
 *
 * PARITY COMPROMISES (wire limitations, not the section's intent):
 * - The trigger `Panel.Button` label is a plain string `"<name>  <type>"` rather
 *   than the old name + `ChevronRightIcon` + muted type spans — the wire button
 *   carries one label, no inline glyph between two text runs.
 * - The old popover's `PopoverHeader` (title + close button) is dropped: the wire
 *   `popoverContent` has no header slot, and the editor is reachable directly.
 */
import type { ComponentAction } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentBoundAction } from "@voidhash/mimic-schema";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import type { PanelJsonValue } from "@voidhash/paywalls/schema";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { useComponentManifest } from "../../../hooks/use-component-manifest";
import { ACTION_TYPE_LABELS } from "../../../panel-kit/action-editor";
import {
  removeComponentActionBinding,
  setComponentActionBinding,
} from "../../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../../state/designer-store";
import {
  collectAncestorVariables,
  toLabeledVariables,
} from "../../../state/utils/ancestor-variables";
import {
  componentBoundActionFromRaw,
  findComponentActionEntry,
} from "../../../state/utils/component-prop-values";
import { selectDocumentRoot } from "../../../state/utils/document-root";
import { useDefinitionNodes } from "./use-definition-nodes";

/** The default action shown for a manifest action with no stored binding. */
const UNBOUND_ACTION: ComponentBoundAction = { type: "none" };

/** The `Component actions` panel definition. */
export function ComponentActionsPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes } = useDefinitionNodes();
  const documentRoot = useStore(store, selectDocumentRoot);

  const node = nodes[0] as ComponentSnapshotNode | undefined;
  const manifest = useComponentManifest(
    (node ?? { data: {} }) as ComponentSnapshotNode,
  );

  const nodeId = node?.id ?? "";
  const variables = useMemo(
    () => toLabeledVariables(collectAncestorVariables(documentRoot, nodeId), nodeId),
    [documentRoot, nodeId],
  );
  const productVariables = useMemo(
    () => variables.filter((v) => v.value.key === "product"),
    [variables],
  );

  const actionEntries = useMemo(
    () => Object.entries(manifest?.actions ?? {}),
    [manifest],
  );

  const [openActionName, setOpenActionName] = useState<string | null>(null);

  if (!node) return <Panel />;

  // Manifest present with zero actions → the whole section renders nothing
  // (matching the old section's `return null`).
  if (manifest !== undefined && actionEntries.length === 0) {
    return <Panel />;
  }

  const handleChange = (actionName: string, action: ComponentBoundAction) => {
    if (action.type === "none") {
      const stored = findComponentActionEntry(node.data.actionBindings, actionName);
      if (stored !== undefined) {
        dispatch(removeComponentActionBinding)({ actionName, nodeId });
      }
      return;
    }
    dispatch(setComponentActionBinding)({ action, actionName, nodeId });
  };

  return (
    <Panel>
      <Panel.Section title="Actions">
        {manifest === undefined ? (
          <Panel.Text
            tone="muted"
            content="This version is not in the project catalog, so its actions can't be bound."
          />
        ) : (
          <Panel.Column gap="sm">
            {actionEntries.map(([actionName, manifestAction]) => {
              const storedEntry = findComponentActionEntry(
                node.data.actionBindings,
                actionName,
              );
              const boundAction =
                (storedEntry === undefined
                  ? undefined
                  : componentBoundActionFromRaw(storedEntry.raw)) ?? UNBOUND_ACTION;
              const payloadFields = Object.keys(
                (manifestAction as ComponentAction).payload,
              );
              return (
                <Panel.Row key={actionName} align="center">
                  <Panel.Popover
                    open={openActionName === actionName}
                    onOpenChange={(open) => setOpenActionName(open ? actionName : null)}
                  >
                    <Panel.PopoverTrigger>
                      <Panel.Button
                        label={`${actionName}  ${ACTION_TYPE_LABELS[boundAction.type]}`}
                        size="sm"
                      />
                    </Panel.PopoverTrigger>
                    <Panel.PopoverContent align="start" side="left">
                      <Panel.ActionEditorField
                        value={boundAction as unknown as PanelJsonValue}
                        variables={variables as unknown as PanelJsonValue}
                        productVariables={productVariables as unknown as PanelJsonValue}
                        payloadFields={payloadFields}
                        onChange={(action) =>
                          handleChange(actionName, action as unknown as ComponentBoundAction)
                        }
                      />
                    </Panel.PopoverContent>
                  </Panel.Popover>
                </Panel.Row>
              );
            })}
          </Panel.Column>
        )}
      </Panel.Section>
    </Panel>
  );
}
