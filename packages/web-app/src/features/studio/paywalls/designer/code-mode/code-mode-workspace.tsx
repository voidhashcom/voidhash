"use client";

import { docRelativeComponentPath } from "@voidhash/paywall-workspace";
import { cn, ResizableHandle, ResizablePanel, ResizablePanelGroup, Spinner } from "@voidhash/ui";
import { lazy, Suspense, useMemo } from "react";
import { useStore } from "zustand/react";

import { useAiPanelOffset } from "../ai-panel/use-ai-panel-offset";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { usePaywallDesignerStore } from "../state/designer-store";
import {
  codeComponentDefinitions,
  selectCodeComponentNodes,
  type CodeComponentDefinition,
} from "../state/utils/code-components";
import type { OpenBuffer } from "./code-editor-pane";
import { CodeEditorTabs } from "./code-editor-tabs";
import { ComponentPreviewPane } from "./component-preview-pane";

const importCodeEditorPane = () => import("./code-editor-pane");
const loadCodeEditorPane = () =>
  importCodeEditorPane().then((module) => ({ default: module.CodeEditorPane }));
const CodeEditorPane = lazy(loadCodeEditorPane);

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

const EDITOR_FALLBACK = (
  <div className="flex h-full items-center justify-center">
    <Spinner className="size-5" />
  </div>
);

/**
 * Resolves the code-component definition an editor tab key (a workspace
 * component path, `/paywalls/<slug>/components/<basename>.tsx`) refers to, by its
 * canonical document-relative path.
 */
function definitionForTabKey(
  definitions: readonly CodeComponentDefinition[],
  key: string,
): CodeComponentDefinition | undefined {
  const docRelative = docRelativeComponentPath(key);
  if (docRelative === undefined) {
    return undefined;
  }
  return definitions.find((definition) => definition.path === docRelative);
}

/**
 * The code-mode canvas region: a horizontal split of a persistent multi-model
 * Monaco editor (with its tab bar) and a live component preview pane. Buffers,
 * tabs, diagnostics, and Monaco models all key on the component's workspace PATH;
 * their source lives directly on the `codeComponent` nodes in the document (no
 * fork). A manual save commits a buffer to its node.
 */
export function CodeModeWorkspace() {
  const store = usePaywallDesignerStore();
  const aiOffset = useAiPanelOffset();
  const leftPanelWidth = useStore(store, (state) => state.viewport.panels.left.width);
  const resizeActive = useStore(store, (state) => state.viewport.panelResizeActive);
  const leftOffset = aiOffset + leftPanelWidth;

  const openTabs = useStore(store, (state) => state.codeComponents.openTabs);
  const activeTabPath = useStore(store, (state) => state.codeComponents.activeTabPath);
  const nodes = useStore(store, selectCodeComponentNodes);
  const compiled = useStore(store, (state) => state.codeComponents.compiled);
  const definitions = useMemo(() => codeComponentDefinitions(nodes), [nodes]);

  // Build the open buffers from the live code-component definitions, keyed by
  // workspace path. A tab whose definition vanished (deleted mid-session) is
  // dropped. Each buffer carries the definition source (seed + external-update
  // reseed) and its compile diagnostics.
  const buffers = useMemo<OpenBuffer[]>(() => {
    const result: OpenBuffer[] = [];
    for (const key of openTabs) {
      const definition = definitionForTabKey(definitions, key);
      if (definition === undefined) {
        continue;
      }
      const compileState = compiled[definition.id];
      const diagnostics = compileState?.status === "error" ? compileState.diagnostics : undefined;
      result.push({
        key,
        definitionId: definition.id,
        source: definition.source,
        diagnostics,
      });
    }
    return result;
  }, [openTabs, definitions, compiled]);

  if (buffers.length === 0) {
    return (
      <Region left={leftOffset} resizeActive={resizeActive}>
        <CenteredMessage>Select or create a code component to start editing.</CenteredMessage>
      </Region>
    );
  }

  const hasActiveBuffer =
    activeTabPath !== null && buffers.some((buffer) => buffer.key === activeTabPath);
  const activeKey = hasActiveBuffer ? (activeTabPath as string) : (buffers[0]?.key ?? "");
  const activeDefinitionId = buffers.find((buffer) => buffer.key === activeKey)?.definitionId;

  return (
    <Region left={leftOffset} resizeActive={resizeActive}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={55} minSize={25}>
          <div className="flex h-full flex-col">
            <CodeEditorTabs />
            <div className="relative min-h-0 flex-1">
              <Suspense fallback={EDITOR_FALLBACK}>
                <CodeEditorPane activeKey={activeKey} buffers={buffers} />
              </Suspense>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={25}>
          {activeDefinitionId !== undefined ? (
            <ComponentPreviewPane definitionId={activeDefinitionId} />
          ) : (
            <CenteredMessage>No preview for this file.</CenteredMessage>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </Region>
  );
}

/** Fixed positioning shell for the code-mode region (right of left panel, below top panel). */
function Region({
  left,
  resizeActive,
  children,
}: {
  left: number;
  resizeActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 bg-background",
        // Suspended while a panel resize handle is dragged so the region
        // tracks the live panel widths instead of easing behind them.
        !resizeActive && "transition-[left] duration-300 ease-in-out",
      )}
      style={{
        left,
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
      }}
    >
      {children}
    </div>
  );
}
