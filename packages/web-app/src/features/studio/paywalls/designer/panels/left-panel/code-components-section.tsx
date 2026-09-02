"use client";

import { cn, useConfirmDialog } from "@voidhash/ui";
import { ChevronDown, ChevronRight, Code2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import { PreviewTreeRenderer } from "../../components/component-preview/preview-tree-renderer";
import {
  createCodeComponent,
  deleteCodeComponent,
  insertLocalComponentNode,
  openTab,
  renameComponentFile,
  setMode,
} from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type { LocalComponentArtifact } from "../../state/designer-store-state";
import { findComponentInsertionParent } from "../../state/utils/component-children";
import {
  codeComponentDefinitions,
  componentDisplayName,
  componentFileName,
  selectCodeComponentNodes,
  type CodeComponentDefinition,
} from "../../state/utils/code-components";
import { selectDocumentRoot } from "../../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";
import { workspacePathForDocRelative } from "@voidhash/paywall-workspace";

import { SCAFFOLD_SOURCE } from "../../code-mode/scaffold";
import { usePaywallCodeTarget } from "../../hooks/use-paywall-code-target";

const THUMBNAIL_TREE_WIDTH = 360;
const THUMBNAIL_SCALE = 0.16;

function Thumbnail({ artifact }: { artifact: LocalComponentArtifact | undefined }) {
  const tree = artifact
    ? (artifact.previewTrees.default ?? Object.values(artifact.previewTrees)[0])
    : undefined;
  return (
    <div className="h-12 w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/40">
      {tree ? (
        <div
          className="origin-top-left"
          style={{ transform: `scale(${THUMBNAIL_SCALE})`, width: THUMBNAIL_TREE_WIDTH }}
        >
          <PreviewTreeRenderer tree={tree} />
        </div>
      ) : null}
    </div>
  );
}

function CodeComponentRow({
  definition,
  onOpen,
  onInsert,
  onRename,
  onDelete,
}: {
  definition: CodeComponentDefinition;
  onOpen: (definition: CodeComponentDefinition) => void;
  onInsert: (definition: CodeComponentDefinition) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (definition: CodeComponentDefinition) => void;
}) {
  const store = usePaywallDesignerStore();
  const artifact = useStore(
    store,
    (state) => state.codeComponents.compiled[definition.id]?.artifact,
  );
  const [editingName, setEditingName] = useState<string | null>(null);

  return (
    <div className="group flex w-full items-center gap-2 rounded-sm p-1 hover:bg-accent/50">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onOpen(definition)}
        type="button"
      >
        <Thumbnail artifact={artifact} />
        <div className="flex min-w-0 flex-1 flex-col">
          {editingName === null ? (
            <span
              className="truncate font-medium text-xs"
              onDoubleClick={(event) => {
                event.stopPropagation();
                setEditingName(componentFileName(definition.path));
              }}
            >
              {componentDisplayName(definition.path)}
            </span>
          ) : (
            <input
              autoFocus
              className="h-5 w-full rounded border border-primary bg-background px-1 text-xs outline-none"
              onBlur={() => {
                onRename(definition.id, editingName);
                setEditingName(null);
              }}
              onChange={(event) => setEditingName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onRename(definition.id, editingName);
                  setEditingName(null);
                } else if (event.key === "Escape") {
                  setEditingName(null);
                }
              }}
              value={editingName}
            />
          )}
          <span className="truncate text-[10px] text-muted-foreground">
            {componentFileName(definition.path)}
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          className="flex size-6 items-center justify-center rounded-sm hover:bg-accent [&_svg]:size-3.5"
          onClick={() => onInsert(definition)}
          title="Insert on canvas"
          type="button"
        >
          <Plus className="text-muted-foreground" />
        </button>
        <button
          className="flex size-6 items-center justify-center rounded-sm hover:bg-accent [&_svg]:size-3.5"
          onClick={() => onDelete(definition)}
          title="Delete"
          type="button"
        >
          <Trash2 className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

/**
 * Library of paywall-scoped code components (source in the mimic doc). Create
 * scaffolds a definition and opens the editor; rows open the editor, insert an
 * instance onto the canvas, rename inline, or delete (with confirmation).
 */
export function CodeComponentsSection() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const target = usePaywallCodeTarget();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState("");

  const nodes = useStore(store, selectCodeComponentNodes);
  const definitions = useMemo(() => codeComponentDefinitions(nodes), [nodes]);
  const documentRoot = useStore(store, selectDocumentRoot);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const selectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );

  const entries = useMemo(() => {
    const list = [...definitions].sort((a, b) =>
      componentDisplayName(a.path).localeCompare(componentDisplayName(b.path)),
    );
    const query = search.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter(
      (entry) =>
        componentDisplayName(entry.path).toLowerCase().includes(query) ||
        componentFileName(entry.path).toLowerCase().includes(query),
    );
  }, [definitions, search]);

  const handleCreate = () => {
    dispatch(createCodeComponent)({ source: SCAFFOLD_SOURCE });
    dispatch(setMode)({ mode: "code" });
  };

  // Design-mode open switches to code mode and opens the component's tab by its
  // workspace path (the editor seeds its buffer from the `codeComponent` node).
  const handleOpen = (definition: CodeComponentDefinition) => {
    if (target !== null) {
      dispatch(openTab)({ path: workspacePathForDocRelative(target.paywallSlug, definition.path) });
    }
    dispatch(setMode)({ mode: "code" });
  };

  const handleInsert = (definition: CodeComponentDefinition) => {
    const parentId = findComponentInsertionParent(documentRoot, selectedNodeIds, byContentHash);
    if (!parentId) {
      return;
    }
    const manifest = store.getState().codeComponents.compiled[definition.id]?.artifact?.manifest;
    dispatch(insertLocalComponentNode)({
      componentPath: definition.path,
      manifest,
      parentId,
    });
  };

  const handleDelete = async (definition: CodeComponentDefinition) => {
    const confirmed = await openDialog({
      confirmText: "Delete",
      description:
        "Instances of this component on the canvas will show a missing-component placeholder. You can undo this.",
      title: `Delete "${componentDisplayName(definition.path)}"?`,
      variant: "destructive",
    });
    if (confirmed) {
      dispatch(deleteCodeComponent)({ id: definition.id });
    }
  };

  return (
    <div className="mt-2 border-border border-t pt-2">
      <div className="flex h-7 items-center gap-1">
        <button
          className="flex flex-1 items-center gap-1 rounded-sm px-1 hover:bg-accent/50"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          <span className="flex size-3 items-center justify-center [&_svg]:size-3">
            {isOpen ? (
              <ChevronDown className="text-muted-foreground" />
            ) : (
              <ChevronRight className="text-muted-foreground" />
            )}
          </span>
          <Code2 className="size-3 text-muted-foreground" />
          <span className="font-medium text-xs">Code Components</span>
        </button>
        <button
          className="flex size-6 items-center justify-center rounded-sm hover:bg-accent [&_svg]:size-3.5"
          onClick={handleCreate}
          title="New code component"
          type="button"
        >
          <Plus className="text-muted-foreground" />
        </button>
      </div>
      {isOpen && (
        <div className="flex flex-col gap-1 pt-1">
          <input
            className={cn(
              "h-7 w-full rounded-sm px-2 text-xs outline-none",
              "bg-input/30 placeholder:text-muted-foreground dark:bg-input/60",
            )}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code components..."
            type="text"
            value={search}
          />
          {entries.length > 0 ? (
            entries.map((definition) => (
              <CodeComponentRow
                definition={definition}
                key={definition.id}
                onDelete={handleDelete}
                onInsert={handleInsert}
                onOpen={handleOpen}
                onRename={(id, value) => {
                  const trimmed = value.trim().replace(/\//g, "");
                  if (!trimmed) {
                    return;
                  }
                  const fileName = trimmed.endsWith(".tsx") ? trimmed : `${trimmed}.tsx`;
                  dispatch(renameComponentFile)({ id, fileName });
                }}
              />
            ))
          ) : (
            <div className="px-2 py-2 font-medium text-muted-foreground text-xs">
              {search.trim() ? "No code components match" : "No code components yet"}
            </div>
          )}
        </div>
      )}
      <ConfirmationDialog />
    </div>
  );
}
