"use client";

import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  IconButtonTooltip,
} from "@voidhash/ui";
import { listBuiltinComponents } from "@voidhash/paywall-builtins";
import { Code2Icon, ComponentIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import {
  createScreenNode,
  createScrollViewNode,
  createTextNode,
  createViewNode,
  insertBuiltinComponentNode,
  insertComponentNode,
  insertLocalComponentNode,
} from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import type { ComponentCatalogEntry } from "../state/designer-store-state";
import {
  type CodeComponentDefinition,
  codeComponentDefinitions,
  componentDisplayName,
  componentFileName,
  selectCodeComponentNodes,
} from "../state/utils/code-components";
import { findInsertionParent } from "../state/utils/component-children";
import { selectDocumentRoot } from "../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import { isEditableElement } from "../hooks/use-keyboard-shortcuts";
import { isMacPlatform } from "../utils/platform";
import { BUILTIN_COMPONENT_ICON, NODE_TYPE_ICONS } from "./node-type-icons";

/** Platform-aware label for the add-component shortcut (⌘J on Mac, Ctrl+J elsewhere). */
function addComponentShortcutLabel(): string {
  return isMacPlatform() ? "⌘J" : "Ctrl+J";
}

/**
 * Bottom action bar "add component" affordance: a button that opens a
 * keyboard-driven command palette listing everything insertable — layout
 * primitives (Text/View/Scroll View/Screen), first-party built-in components,
 * deployed catalog components, and paywall-scoped code components. Selecting an
 * entry inserts it into the nearest valid parent of the current selection
 * (falling back to the first screen; Screen inserts under the document root)
 * and closes the palette.
 */
export function AddComponentCommand() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const [open, setOpen] = useState(false);

  // Cmd/Ctrl+J toggles the palette. This component only mounts in design mode
  // (the action bar hides the add button in preview/code), so the shortcut is
  // inherently inactive there. While closed it is suppressed when an editable
  // element is focused so it never steals input from fields, contenteditable,
  // or the Monaco editor; while open, focus sits in the palette's own search
  // input, so the guard is skipped to let the shortcut close it again.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modKey = isMacPlatform() ? e.metaKey : e.ctrlKey;
      if (!modKey || e.shiftKey || e.altKey || e.key.toLowerCase() !== "j") {
        return;
      }
      if (!open && isEditableElement(e.target)) {
        return;
      }
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const documentRoot = useStore(store, selectDocumentRoot);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const components = useStore(store, (state) => state.componentCatalog.components);
  const codeNodes = useStore(store, selectCodeComponentNodes);
  const selectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );

  const catalogEntries = useMemo(
    () =>
      Object.values(components).sort((a, b) =>
        (a.title ?? a.slug).localeCompare(b.title ?? b.slug),
      ),
    [components],
  );
  const codeDefinitions = useMemo(
    () =>
      [...codeComponentDefinitions(codeNodes)].sort((a, b) =>
        componentDisplayName(a.path).localeCompare(componentDisplayName(b.path)),
      ),
    [codeNodes],
  );
  // Slot builtins are gated OFF for now: the edit canvas renders builtin
  // instances as a preact island and slot children can't render inside the
  // island yet, so only slotless builtins are offered for insertion.
  const builtinDefinitions = useMemo(
    () =>
      listBuiltinComponents()
        .filter((definition) => definition.manifest.slot !== true)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // Runs `insert` against the freshly resolved parent for a `childType`, then
  // closes the palette. The parent is resolved on select (not on open) so a
  // selection change made while the palette is open is honored.
  const runInsert = useCallback(
    (childType: string, insert: (parentId: string) => void) => {
      const parentId = findInsertionParent(documentRoot, childType, selectedNodeIds, byContentHash);
      if (parentId) {
        insert(parentId);
      }
      setOpen(false);
    },
    [documentRoot, selectedNodeIds, byContentHash],
  );

  const insertText = useCallback(
    () => runInsert("text", (parentId) => dispatch(createTextNode)({ parentId })),
    [dispatch, runInsert],
  );

  const insertView = useCallback(
    () =>
      runInsert("view", (parentId) =>
        dispatch(createViewNode)({ insertAffordance: true, parentId }),
      ),
    [dispatch, runInsert],
  );

  const insertScrollView = useCallback(
    () =>
      runInsert("scrollView", (parentId) =>
        dispatch(createScrollViewNode)({ insertAffordance: true, parentId }),
      ),
    [dispatch, runInsert],
  );

  // Screens live directly under the document root, not under the current
  // selection — createScreenNode inserts into whatever `parentId` it is given.
  const insertScreen = useCallback(() => {
    if (documentRoot) {
      dispatch(createScreenNode)({ parentId: documentRoot.id });
    }
    setOpen(false);
  }, [dispatch, documentRoot]);

  const primitiveItems = useMemo(
    () => [
      { icon: NODE_TYPE_ICONS.text, key: "text", label: "Text", onSelect: insertText },
      { icon: NODE_TYPE_ICONS.view, key: "view", label: "View", onSelect: insertView },
      {
        icon: NODE_TYPE_ICONS.scrollView,
        key: "scrollView",
        label: "Scroll View",
        onSelect: insertScrollView,
      },
      { icon: NODE_TYPE_ICONS.screen, key: "screen", label: "Screen", onSelect: insertScreen },
    ],
    [insertText, insertView, insertScrollView, insertScreen],
  );

  const insertCatalog = useCallback(
    (entry: ComponentCatalogEntry) =>
      runInsert("component", (parentId) =>
        dispatch(insertComponentNode)({ component: entry, parentId }),
      ),
    [dispatch, runInsert],
  );

  const insertBuiltin = useCallback(
    (definition: (typeof builtinDefinitions)[number]) =>
      runInsert("component", (parentId) =>
        dispatch(insertBuiltinComponentNode)({
          defaultProps: definition.defaultProps,
          name: definition.name,
          parentId,
          slug: definition.slug,
        }),
      ),
    [dispatch, runInsert],
  );

  const insertLocal = useCallback(
    (definition: CodeComponentDefinition) =>
      runInsert("component", (parentId) => {
        const manifest = store.getState().codeComponents.compiled[definition.id]?.artifact?.manifest;
        dispatch(insertLocalComponentNode)({
          componentPath: definition.path,
          manifest,
          parentId,
        });
      }),
    [dispatch, runInsert, store],
  );

  return (
    <>
      <IconButtonTooltip
        label={
          <span className="flex items-center gap-2">
            Add component
            <span className="text-muted-foreground">{addComponentShortcutLabel()}</span>
          </span>
        }
      >
        <Button
          aria-label="Add component"
          onClick={() => setOpen(true)}
          size="icon-sm"
          variant="outline"
        >
          <ComponentIcon />
        </Button>
      </IconButtonTooltip>
      <CommandDialog
        description="Search components to add to the canvas"
        onOpenChange={setOpen}
        open={open}
        title="Add component"
      >
        <CommandInput placeholder="Add a component..." />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>
          <CommandGroup heading="Primitives">
            {primitiveItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.key}
                  onSelect={item.onSelect}
                  value={`primitive ${item.label} ${item.key}`}
                >
                  {Icon && <Icon />}
                  <span className="flex-1 truncate">{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          {builtinDefinitions.length > 0 && (
            <CommandGroup heading="Built-in Components">
              {builtinDefinitions.map((definition) => (
                <CommandItem
                  key={definition.slug}
                  onSelect={() => insertBuiltin(definition)}
                  value={`builtin ${definition.name} ${definition.slug}`}
                >
                  <BUILTIN_COMPONENT_ICON />
                  <span className="flex-1 truncate">{definition.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {catalogEntries.length > 0 && (
            <CommandGroup heading="Components">
              {catalogEntries.map((entry) => (
                <CommandItem
                  key={entry.slug}
                  onSelect={() => insertCatalog(entry)}
                  value={`component ${entry.title ?? ""} ${entry.slug}`}
                >
                  <ComponentIcon />
                  <span className="flex-1 truncate">{entry.title ?? entry.slug}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    v{entry.latestVersion}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {codeDefinitions.length > 0 && (
            <CommandGroup heading="Code Components">
              {codeDefinitions.map((definition) => (
                <CommandItem
                  key={definition.id}
                  onSelect={() => insertLocal(definition)}
                  value={`code ${componentDisplayName(definition.path)} ${componentFileName(definition.path)}`}
                >
                  <Code2Icon />
                  <span className="flex-1 truncate">{componentDisplayName(definition.path)}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {componentFileName(definition.path)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
