"use client";

import {
  hotkeysCoreFeature,
  type ItemInstance,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ScrollArea,
  useConfirmDialog,
} from "@voidhash/ui";
import { workspacePathForDocRelative } from "@voidhash/paywall-workspace";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import {
  closeTab,
  createCodeComponent,
  deleteCodeComponent,
  openTab,
  renameComponentFile,
} from "../../state/actions";
import { useCodeEditor } from "../../code-mode/code-editor-context";
import { SCAFFOLD_SOURCE } from "../../code-mode/scaffold";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import {
  codeComponentDefinitions,
  componentFileName,
  selectCodeComponentNodes,
  type CodeComponentDefinition,
} from "../../state/utils/code-components";
import { usePaywallCodeTarget } from "../../hooks/use-paywall-code-target";

/** A single node in the virtual file tree (a folder or a file "row"). */
interface FileNode {
  name: string;
  isFolder: boolean;
  children: string[];
}

/** Synthetic ids for the virtual root + the `components` folder. */
const ROOT_ID = "__root__";
const COMPONENTS_FOLDER_ID = "__components__";
const INDENT_PX = 12;

/** Returned for ids headless-tree may transiently query during a rebuild. */
const MISSING_NODE: FileNode = { children: [], isFolder: false, name: "" };

/**
 * Builds the virtual tree data from the document's code-component definitions: a
 * `components` folder holding one file row per definition, keyed by its workspace
 * PATH. Each row's display name is its `<basename>.tsx` file name.
 */
function buildFileMap(
  definitions: readonly CodeComponentDefinition[],
  paywallSlug: string | undefined,
): { map: Record<string, FileNode>; pathById: Record<string, string> } {
  const map: Record<string, FileNode> = {
    [ROOT_ID]: { children: [COMPONENTS_FOLDER_ID], isFolder: true, name: "root" },
    [COMPONENTS_FOLDER_ID]: { children: [], isFolder: true, name: "components" },
  };
  const pathById: Record<string, string> = {};
  if (paywallSlug === undefined) {
    return { map, pathById };
  }
  for (const definition of definitions) {
    const path = workspacePathForDocRelative(paywallSlug, definition.path);
    map[COMPONENTS_FOLDER_ID]?.children.push(path);
    map[path] = { children: [], isFolder: false, name: componentFileName(definition.path) };
    pathById[path] = definition.id;
  }
  return { map, pathById };
}

/**
 * Code-mode left panel: a fully virtual file tree (headless-tree) listing the
 * paywall's code-component definitions. Clicking a file opens it in the editor;
 * the header `+` creates a new component; rename/delete run the document-native
 * (undoable) code-component actions — there is no fork.
 */
export function CodeFileTree() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const target = usePaywallCodeTarget();
  const { handle } = useCodeEditor();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const nodes = useStore(store, selectCodeComponentNodes);
  const activeTabPath = useStore(store, (state) => state.codeComponents.activeTabPath);
  const dirty = useStore(store, useShallow((state) => state.codeComponents.dirty));

  const definitions = useMemo(() => codeComponentDefinitions(nodes), [nodes]);
  const paywallSlug = target?.paywallSlug;

  const { map: fileMap, pathById } = useMemo(
    () => buildFileMap(definitions, paywallSlug),
    [definitions, paywallSlug],
  );
  const fileMapRef = useRef(fileMap);
  fileMapRef.current = fileMap;
  const pathByIdRef = useRef(pathById);
  pathByIdRef.current = pathById;

  const handleOpen = useCallback(
    (path: string) => {
      dispatch(openTab)({ path });
    },
    [dispatch],
  );

  const handleCreate = useCallback(() => {
    const result = dispatch(createCodeComponent)({ source: SCAFFOLD_SOURCE });
    if (result.nodeId === null || paywallSlug === undefined) {
      return;
    }
    const definition = codeComponentDefinitions(selectCodeComponentNodes(store.getState())).find(
      (candidate) => candidate.id === result.nodeId,
    );
    if (definition !== undefined) {
      dispatch(openTab)({ path: workspacePathForDocRelative(paywallSlug, definition.path) });
    }
  }, [dispatch, paywallSlug, store]);

  const handleRename = useCallback(
    (path: string, value: string) => {
      const id = pathByIdRef.current[path];
      if (id === undefined || paywallSlug === undefined) {
        return;
      }
      const trimmed = value.trim().replace(/\//g, "");
      if (!trimmed) {
        return;
      }
      const fileName = trimmed.endsWith(".tsx") ? trimmed : `${trimmed}.tsx`;
      const result = dispatch(renameComponentFile)({ id, fileName });
      if (result.nextPath === null) {
        return;
      }
      // Follow the rename in the open-tab list — but re-KEY the Monaco model
      // (preserving its text, view state, and undo history) rather than
      // open/close, which disposes the old model and silently drops unsaved edits.
      const to = workspacePathForDocRelative(paywallSlug, result.nextPath);
      const wasOpen = store.getState().codeComponents.openTabs.includes(path);
      if (wasOpen && to !== path) {
        handle?.renameModel(path, to);
        dispatch(openTab)({ path: to });
        dispatch(closeTab)({ path });
      }
    },
    [dispatch, handle, paywallSlug, store],
  );

  const handleDelete = useCallback(
    async (path: string, name: string) => {
      const id = pathByIdRef.current[path];
      if (id === undefined) {
        return;
      }
      const confirmed = await openDialog({
        confirmText: "Delete",
        description:
          "Instances of this component on the canvas will show a missing-component placeholder. You can undo this.",
        title: `Delete "${name}"?`,
        variant: "destructive",
      });
      if (confirmed) {
        dispatch(deleteCodeComponent)({ id });
        dispatch(closeTab)({ path });
      }
    },
    [dispatch, openDialog],
  );

  const tree = useTree<FileNode>({
    canRename: (item) => !item.getItemData().isFolder,
    dataLoader: {
      getChildren: (id) => fileMapRef.current[id]?.children ?? [],
      getItem: (id) => fileMapRef.current[id] ?? MISSING_NODE,
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, renamingFeature],
    getItemName: (item) => item.getItemData().name,
    indent: INDENT_PX,
    initialState: { expandedItems: [COMPONENTS_FOLDER_ID] },
    isItemFolder: (item) => item.getItemData().isFolder,
    onPrimaryAction: (item) => {
      if (!item.getItemData().isFolder) {
        handleOpen(item.getId());
      }
    },
    onRename: (item, value) => handleRename(item.getId(), value),
    rootItemId: ROOT_ID,
  });

  // Rebuild the data loader whenever the component set changes.
  const signature = useMemo(
    () => Object.keys(pathById).sort().join("|"),
    [pathById],
  );
  useEffect(() => {
    tree.rebuildTree();
  }, [signature, tree]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-border border-b px-2">
        <span className="font-medium text-muted-foreground text-xs">Files</span>
        <button
          className="flex size-6 items-center justify-center rounded-sm hover:bg-accent [&_svg]:size-3.5"
          onClick={handleCreate}
          title="New code component"
          type="button"
        >
          <Plus className="text-muted-foreground" />
        </button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1" {...tree.getContainerProps("Code components")}>
          {tree.getItems().map((item) => renderTreeItem(item))}
        </div>
      </ScrollArea>
      <ConfirmationDialog />
    </div>
  );

  /**
   * Renders one tree row. Component files are wrapped in a right-click context
   * menu (Rename / Delete) and swap to an inline input while being renamed; the
   * `components` folder is a plain row.
   */
  function renderTreeItem(item: ItemInstance<FileNode>) {
    const id = item.getId();
    const isFolder = item.isFolder();
    const isExpanded = item.isExpanded();
    const isActive = !isFolder && id === activeTabPath;
    const isRenaming = !isFolder && item.isRenaming();
    const isFile = !isFolder;
    const isDirty = isFile && dirty[id] === true;
    const level = item.getItemMeta().level;

    const row = (
      <div
        {...item.getProps()}
        className={cn(
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm pr-2 text-xs outline-none",
          "hover:bg-accent/50 focus-visible:bg-accent/50",
          isActive && "bg-accent text-accent-foreground hover:bg-accent",
        )}
        key={item.getKey()}
        onDoubleClick={(event) => {
          if (!isFolder) {
            event.stopPropagation();
            item.startRenaming();
          }
        }}
        style={{ paddingLeft: level * INDENT_PX + 4 }}
      >
        <span className="flex size-3 shrink-0 items-center justify-center [&_svg]:size-3">
          {isFolder &&
            (isExpanded ? (
              <ChevronDown className="text-muted-foreground" />
            ) : (
              <ChevronRight className="text-muted-foreground" />
            ))}
        </span>
        <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="text-muted-foreground" />
            ) : (
              <Folder className="text-muted-foreground" />
            )
          ) : (
            <FileCode className="text-muted-foreground" />
          )}
        </span>
        {isRenaming ? (
          <input
            {...item.getRenameInputProps()}
            className="h-5 min-w-0 flex-1 rounded border border-primary bg-background px-1 font-medium text-xs outline-none"
            onBlur={() => tree.completeRenaming()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{item.getItemName()}</span>
        )}
        {isDirty && !isRenaming && (
          <span className="flex size-3 shrink-0 items-center justify-center">
            <span className="size-1.5 rounded-full bg-foreground" />
          </span>
        )}
      </div>
    );

    // The `components` folder has no rename/delete context menu.
    if (isFolder) {
      return row;
    }

    return (
      <ContextMenu key={item.getKey()}>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent
          className="w-40"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ContextMenuItem
            onSelect={() => {
              requestAnimationFrame(() => item.startRenaming());
            }}
          >
            <Pencil className="text-muted-foreground" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => handleDelete(id, item.getItemName())} variant="destructive">
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
}
