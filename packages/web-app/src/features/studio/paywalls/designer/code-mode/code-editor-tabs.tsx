"use client";

import { Button, cn, useConfirmDialog } from "@voidhash/ui";
import { parseWorkspacePath } from "@voidhash/paywall-workspace";
import { Redo2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand/react";

import { closeTab, openTab } from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { codeComponentDefinitions, selectCodeComponentNodes } from "../state/utils/code-components";
import { docRelativeComponentPath } from "@voidhash/paywall-workspace";
import { useCodeEditor } from "./code-editor-context";

/** The display label for a component tab key (its `<basename>.tsx` file name). */
function labelForKey(key: string): string {
  const parsed = parseWorkspacePath(key);
  if (parsed.ok && parsed.path.kind === "component") {
    return parsed.path.fileName;
  }
  return key;
}

/**
 * Horizontal tab bar of the open code-editor buffers, sitting directly above the
 * Monaco editor. Renders one tab per `openTabs` entry (a component workspace
 * path), highlights the active tab, shows an unsaved dot when a buffer is dirty,
 * and closes a tab on its hover-revealed X (confirming when the buffer has
 * unsaved edits, then reverting to the document source).
 *
 * The right edge carries Undo/Redo plus Save. Save commits every dirty buffer to
 * its `codeComponent` node (one buffer = one undoable transaction) and is bound
 * to Cmd/Ctrl+S.
 */
export function CodeEditorTabs() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const { handle } = useCodeEditor();

  const openTabs = useStore(store, (state) => state.codeComponents.openTabs);
  const activeTabPath = useStore(store, (state) => state.codeComponents.activeTabPath);
  const dirty = useStore(store, (state) => state.codeComponents.dirty);
  const nodes = useStore(store, selectCodeComponentNodes);

  const hasActive = activeTabPath !== null && handle !== null;
  const anyDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  // Cmd/Ctrl+S saves every dirty buffer, wherever focus is.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handle?.saveAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handle]);

  const activate = useCallback(
    (key: string) => {
      dispatch(openTab)({ path: key });
    },
    [dispatch],
  );

  // Reverts a buffer to its document `source` (its `codeComponent` node) so a
  // closed tab's unsaved edits do not linger. A no-op when the definition is gone.
  const revertBuffer = useCallback(
    (key: string) => {
      const docRelative = docRelativeComponentPath(key);
      if (docRelative === undefined) {
        return;
      }
      const definition = codeComponentDefinitions(nodes).find(
        (candidate) => candidate.path === docRelative,
      );
      if (definition !== undefined) {
        handle?.setBufferContent(key, definition.source);
      }
    },
    [handle, nodes],
  );

  const handleClose = useCallback(
    async (key: string) => {
      if (dirty[key]) {
        const confirmed = await openDialog({
          confirmText: "Discard",
          description: `“${labelForKey(key)}” has unsaved changes that will be lost.`,
          title: "Discard changes?",
          variant: "destructive",
        });
        if (!confirmed) {
          return;
        }
        // Reset the buffer to its saved source before closing so its unsaved
        // edits don't survive as a stale dirty flag.
        revertBuffer(key);
      }
      dispatch(closeTab)({ path: key });
    },
    [dirty, dispatch, openDialog, revertBuffer],
  );

  return (
    <div className="flex h-9 shrink-0 items-stretch border-border border-b">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {openTabs.map((key) => {
          const isActive = key === activeTabPath;
          const isDirty = Boolean(dirty[key]);

          return (
            <div
              className={cn(
                "group flex shrink-0 cursor-pointer items-center gap-2 border-border border-r px-3 text-xs outline-none",
                "hover:bg-accent/50",
                isActive && "bg-accent text-accent-foreground hover:bg-accent",
              )}
              key={key}
              onClick={() => activate(key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(key);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="truncate">{labelForKey(key)}</span>
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {isDirty && (
                  <span className="size-1.5 rounded-full bg-current/70 group-hover:hidden" />
                )}
                <button
                  aria-label={`Close ${labelForKey(key)}`}
                  className="hidden size-3.5 items-center justify-center rounded-sm hover:bg-accent group-hover:flex [&_svg]:size-3.5"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleClose(key);
                  }}
                  type="button"
                >
                  <X />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 border-border border-l px-1.5">
        <Button
          disabled={!hasActive}
          onClick={() => handle?.undo()}
          size="icon-sm"
          title="Undo"
          variant="ghost"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          disabled={!hasActive}
          onClick={() => handle?.redo()}
          size="icon-sm"
          title="Redo"
          variant="ghost"
        >
          <Redo2 className="size-4" />
        </Button>
        <Button className="ml-1" disabled={!anyDirty} onClick={() => handle?.saveAll()} size="sm">
          Save
        </Button>
      </div>
      <ConfirmationDialog />
    </div>
  );
}
