"use client";

import {
  Button,
  cn,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voidhash/ui";
import { Code2Icon, InfoIcon, LinkIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { useComponentNodeWarnings } from "@/features/studio/paywalls/designer/hooks/use-component-node-warnings";
import { repairLocalComponentReference } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import {
  codeComponentDefinitions,
  componentDisplayName,
  componentFileName,
  selectCodeComponentNodes,
} from "@/features/studio/paywalls/designer/state/utils/code-components";

export interface ComponentWarningsBlockProps {
  nodeId: string;
}

/**
 * Validation summary for the selected component node, rendered above the
 * right-panel panels (spec §7.4): amber rows for warnings, muted rows for
 * info. When the instance references a component file that no longer exists
 * (`component-unresolved`), a primary "Pair to a component file…" action opens a
 * picker to re-point it at an existing file.
 */
export function ComponentWarningsBlock({ nodeId }: ComponentWarningsBlockProps) {
  const warnings = useComponentNodeWarnings(nodeId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const unresolved = warnings.find((warning) => warning.kind === "component-unresolved");

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 border-border border-b px-4 py-3">
      {warnings.map((warning) => (
        <div
          className={cn(
            "flex flex-row items-start gap-1.5 text-xs",
            warning.severity === "warning" ? "text-amber-500" : "text-muted-foreground",
          )}
          key={`${warning.kind}:${warning.message}`}
        >
          {warning.severity === "warning" ? (
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{warning.message}</span>
        </div>
      ))}
      {unresolved !== undefined && (
        <>
          <Button
            className="mt-1 self-start"
            onClick={() => setPickerOpen(true)}
            size="sm"
            variant="outline"
          >
            <LinkIcon />
            Pair to a component file…
          </Button>
          <PairComponentPicker nodeId={nodeId} onOpenChange={setPickerOpen} open={pickerOpen} />
        </>
      )}
    </div>
  );
}

/**
 * A command-palette picker (mirroring the Add Component dialog pattern) listing
 * the document's component files by basename. Picking one re-points the
 * instance's `componentPath` via {@link repairLocalComponentReference}. Files
 * whose definition has not compiled yet are still selectable, annotated with a
 * "not compiled yet" note.
 */
function PairComponentPicker({
  nodeId,
  open,
  onOpenChange,
}: {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const codeNodes = useStore(store, selectCodeComponentNodes);
  const compiled = useStore(store, (state) => state.codeComponents.compiled);

  const definitions = useMemo(
    () =>
      [...codeComponentDefinitions(codeNodes)].sort((a, b) =>
        componentDisplayName(a.path).localeCompare(componentDisplayName(b.path)),
      ),
    [codeNodes],
  );

  return (
    <CommandDialog
      description="Pick a component file to pair this instance with"
      onOpenChange={onOpenChange}
      open={open}
      title="Pair to a component file"
    >
      <CommandInput placeholder="Search component files..." />
      <CommandList>
        <CommandEmpty>No component files in this paywall.</CommandEmpty>
        {definitions.length > 0 && (
          <CommandGroup heading="Component files">
            {definitions.map((definition) => {
              const compiledArtifact = compiled[definition.id]?.artifact;
              return (
                <CommandItem
                  key={definition.id}
                  onSelect={() => {
                    dispatch(repairLocalComponentReference)({
                      nodeId,
                      componentPath: definition.path,
                    });
                    onOpenChange(false);
                  }}
                  value={`${componentDisplayName(definition.path)} ${componentFileName(definition.path)}`}
                >
                  <Code2Icon />
                  <span className="flex-1 truncate">{componentFileName(definition.path)}</span>
                  {compiledArtifact === undefined && (
                    <span className="shrink-0 text-muted-foreground text-xs">not compiled yet</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
