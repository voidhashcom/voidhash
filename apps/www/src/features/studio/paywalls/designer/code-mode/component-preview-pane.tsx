"use client";

import { cn, Spinner, ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import { useRef } from "react";
import { useStore } from "zustand/react";

import { PreviewTreeRenderer } from "../components/component-preview/preview-tree-renderer";
import { setCodeEditorPreviewState } from "../state/actions/code-component-editor-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import type { LocalComponentArtifact } from "../state/designer-store-state";
import { selectCodeComponentCompiled } from "../state/utils/code-components";

/** Preview-state fallback: local selection → "default" → first available. */
function resolvePreviewState(available: readonly string[], selected: string | null): string | undefined {
  for (const candidate of [selected, "default"]) {
    if (candidate !== null && candidate !== "" && available.includes(candidate)) {
      return candidate;
    }
  }
  return available[0];
}

/**
 * Live preview of the selected code component: renders the compiled preview
 * tree with the trusted `PreviewTreeRenderer`, a preview-state switcher, and a
 * diagnostics panel. Keeps the last good tree visible during recompiles so the
 * preview never flashes empty on every keystroke.
 */
export function ComponentPreviewPane({ definitionId }: { definitionId: string }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  // Read the component's compile — driven by the compile pipeline watching its
  // `codeComponent` node, so a save (or any source change) recompiles the preview.
  const compiled = useStore(store, selectCodeComponentCompiled(definitionId));
  const previewState = useStore(store, (state) => state.codeComponents.previewState);

  const lastGood = useRef<LocalComponentArtifact | null>(null);
  if (compiled?.status === "ready" && compiled.artifact) {
    lastGood.current = compiled.artifact;
  }

  const status = compiled?.status ?? "idle";
  const artifact = compiled?.artifact ?? lastGood.current;
  const states = artifact ? Object.keys(artifact.previewTrees) : [];
  const activeState = resolvePreviewState(states, previewState);
  const tree = artifact && activeState ? artifact.previewTrees[activeState] : undefined;
  const isStale = status !== "ready" && artifact !== null;

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-border border-b px-2">
        <div className="flex items-center gap-2">
          {states.length > 1 && (
            <ToggleGroup
              onValueChange={(value) => {
                if (value) {
                  dispatch(setCodeEditorPreviewState)({ state: value });
                }
              }}
              size="sm"
              type="single"
              value={activeState}
            >
              {states.map((state) => (
                <ToggleGroupItem className="text-xs" key={state} size="sm" value={state}>
                  {state}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
        {status === "compiling" && (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Spinner className="size-3" /> Compiling…
          </span>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-auto p-6">
        {tree ? (
          <div
            className={cn(
              "w-full max-w-[375px] overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-opacity",
              isStale && "opacity-60",
            )}
          >
            <PreviewTreeRenderer tree={tree} />
          </div>
        ) : status === "compiling" || status === "idle" ? (
          <div className="h-40 w-full max-w-[375px] animate-pulse rounded-xl bg-muted" />
        ) : (
          <p className="text-muted-foreground text-sm">No preview available</p>
        )}
      </div>

      {status === "error" && compiled?.diagnostics && compiled.diagnostics.length > 0 && (
        <div className="max-h-40 shrink-0 overflow-auto border-border border-t bg-destructive/5 p-2">
          {compiled.diagnostics.map((diagnostic, index) => (
            <div
              className="flex items-start gap-2 py-0.5 font-mono text-[11px] text-destructive"
              // diagnostics are positional and ephemeral
              key={index}
            >
              <span className="shrink-0 rounded-sm bg-destructive/10 px-1 uppercase">
                {diagnostic.phase}
              </span>
              <span className="min-w-0">
                {diagnostic.line !== undefined ? `Line ${diagnostic.line}: ` : ""}
                {diagnostic.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
