"use client";

import { cn } from "@voidhash/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import { PreviewTreeRenderer } from "../../components/component-preview/preview-tree-renderer";
import { useComponentPreviewTree } from "../../components/component-preview/use-preview-tree";
import { insertComponentNode } from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type {
  ComponentCatalogEntry,
  ComponentCatalogVersion,
} from "../../state/designer-store-state";
import { findComponentInsertionParent } from "../../state/utils/component-children";
import { selectDocumentRoot } from "../../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";

const THUMBNAIL_TREE_WIDTH = 360;
const THUMBNAIL_SCALE = 0.16;

function ComponentThumbnail({ version }: { version: ComponentCatalogVersion }) {
  const { data: tree } = useComponentPreviewTree({
    artifactBaseUrl: version.artifactBaseUrl,
    contentHash: version.contentHash,
    state: "default",
  });

  return (
    <div className="h-12 w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/40">
      {tree ? (
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${THUMBNAIL_SCALE})`,
            width: THUMBNAIL_TREE_WIDTH,
          }}
        >
          <PreviewTreeRenderer tree={tree} />
        </div>
      ) : null}
    </div>
  );
}

function ComponentRow({
  entry,
  onInsert,
}: {
  entry: ComponentCatalogEntry;
  onInsert: (entry: ComponentCatalogEntry) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-sm p-1 text-left hover:bg-accent/50"
      onClick={() => onInsert(entry)}
      type="button"
    >
      <ComponentThumbnail version={entry.latest} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-xs">{entry.title ?? entry.slug}</span>
        <span className="truncate text-[10px] text-muted-foreground">{entry.slug}</span>
      </div>
      <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
        v{entry.latestVersion}
      </span>
    </button>
  );
}

/**
 * Library of deployed code components for the current project. Click inserts
 * an instance into the nearest valid parent of the current selection
 * (catalog rules + manifest slot gate), falling back to the first screen.
 */
export function ComponentsSection() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState("");

  const components = useStore(store, (state) => state.componentCatalog.components);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const selectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );
  const documentRoot = useStore(store, selectDocumentRoot);

  const entries = useMemo(() => {
    const list = Object.values(components).sort((a, b) =>
      (a.title ?? a.slug).localeCompare(b.title ?? b.slug),
    );
    const query = search.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter(
      (entry) =>
        entry.slug.toLowerCase().includes(query) ||
        (entry.title ?? "").toLowerCase().includes(query),
    );
  }, [components, search]);

  const handleInsert = (entry: ComponentCatalogEntry) => {
    const parentId = findComponentInsertionParent(documentRoot, selectedNodeIds, byContentHash);
    if (!parentId) {
      return;
    }
    dispatch(insertComponentNode)({ component: entry, parentId });
  };

  return (
    <div className="mt-2 border-border border-t pt-2">
      <button
        className="flex h-7 w-full items-center gap-1 rounded-sm px-1 hover:bg-accent/50"
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
        <span className="font-medium text-xs">Components</span>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1 pt-1">
          <input
            className={cn(
              "h-7 w-full rounded-sm px-2 text-xs outline-none",
              "bg-input/30 placeholder:text-muted-foreground dark:bg-input/60",
            )}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            type="text"
            value={search}
          />
          {entries.length > 0 ? (
            entries.map((entry) => (
              <ComponentRow entry={entry} key={entry.slug} onInsert={handleInsert} />
            ))
          ) : (
            <div className="px-2 py-2 font-medium text-muted-foreground text-xs">
              {search.trim() ? "No components match" : "No components deployed"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
