"use client";

import type { ComponentAction } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentBoundAction } from "@voidhash/mimic-schema";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/panel-kit/panel-section";
import { useComponentManifest } from "@/features/studio/paywalls/designer/hooks/use-component-manifest";
import type { LabeledVariable } from "@/features/studio/paywalls/designer/components/variables/types";
import {
  removeComponentActionBinding,
  setComponentActionBinding,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import {
  collectAncestorVariables,
  toLabeledVariables,
} from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import {
  componentBoundActionFromRaw,
  findComponentActionEntry,
} from "@/features/studio/paywalls/designer/state/utils/component-prop-values";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";

import { ActionEditor, ACTION_TYPE_LABELS } from "@/features/studio/paywalls/designer/panel-kit/action-editor";
import { PopoverHeader } from "@/features/studio/paywalls/designer/panel-kit/popover-header";

const UNBOUND_ACTION: ComponentBoundAction = { type: "none" };

function ComponentActionRow({
  node,
  actionName,
  manifestAction,
  variables,
  productVariables,
}: {
  node: ComponentSnapshotNode;
  actionName: string;
  manifestAction: ComponentAction;
  variables: readonly LabeledVariable[];
  productVariables: readonly LabeledVariable[];
}) {
  const dispatch = usePaywallDesignerActions();
  const [isOpen, setIsOpen] = useState(false);

  const storedEntry = findComponentActionEntry(node.data.actionBindings, actionName);
  const boundAction =
    (storedEntry === undefined ? undefined : componentBoundActionFromRaw(storedEntry.raw)) ??
    UNBOUND_ACTION;

  const payloadFields = useMemo(
    () => Object.keys(manifestAction.payload),
    [manifestAction.payload],
  );

  const handleChange = (action: ComponentBoundAction) => {
    if (action.type === "none") {
      if (storedEntry !== undefined) {
        dispatch(removeComponentActionBinding)({ actionName, nodeId: node.id });
      }
      return;
    }
    dispatch(setComponentActionBinding)({ action, actionName, nodeId: node.id });
  };

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <Button className="w-full justify-start gap-1 px-2" size="sm" variant="secondary">
          <span className="text-xs">{actionName}</span>
          <ChevronRightIcon className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground text-xs">
            {ACTION_TYPE_LABELS[boundAction.type]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3" side="left" sideOffset={4}>
        <PopoverHeader onClose={() => setIsOpen(false)} title={actionName} />
        <ActionEditor
          action={boundAction}
          onChange={handleChange}
          payloadFields={payloadFields}
          productVariables={productVariables}
          variables={variables}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface ComponentActionsSectionProps {
  node: ComponentSnapshotNode;
}

export function ComponentActionsSection({ node }: ComponentActionsSectionProps) {
  const store = usePaywallDesignerStore();
  const documentRoot = useStore(store, selectDocumentRoot);

  const manifest = useComponentManifest(node);

  const variables = useMemo(
    () => toLabeledVariables(collectAncestorVariables(documentRoot, node.id), node.id),
    [documentRoot, node.id],
  );

  const productVariables = useMemo(
    () => variables.filter((v) => v.value.key === "product"),
    [variables],
  );

  const actionEntries = useMemo(() => Object.entries(manifest?.actions ?? {}), [manifest]);

  if (manifest !== undefined && actionEntries.length === 0) {
    return null;
  }

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Actions</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        {manifest === undefined ? (
          <p className="text-muted-foreground text-xs">
            This version is not in the project catalog, so its actions can&apos;t be bound.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {actionEntries.map(([actionName, manifestAction]) => (
              <ComponentActionRow
                actionName={actionName}
                key={actionName}
                manifestAction={manifestAction}
                node={node}
                productVariables={productVariables}
                variables={variables}
              />
            ))}
          </div>
        )}
      </PanelSectionContent>
    </PanelSection>
  );
}
