"use client";

import { Button, Input } from "@voidhash/ui";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import { usePaywallDesignerStore } from "../state/designer-store";
import { selectDocumentRoot } from "../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import { DevLayersPanel } from "./dev-layers-panel";
import { JsonTreeViewer, findMatchingPaths } from "./json-tree-viewer";
import { NodeDetailsPanel, findNodeById } from "./node-details-panel";

interface SnapshotNode {
  id: string;
  type: string;
  children?: readonly SnapshotNode[];
}

export function SnapshotInspector() {
  const store = usePaywallDesignerStore();
  const documentRoot = useStore(store, selectDocumentRoot);
  const designerSelectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );

  // Initialize with the first selected node from the designer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const state = store.getState();
    const ids = selectedNodeIdsFromPresence(state.mimic.presence?.self);
    return ids[0] ?? null;
  });
  const [highlightPath, setHighlightPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Sync selection when designer selection changes
  useEffect(() => {
    if (designerSelectedNodeIds.length > 0 && designerSelectedNodeIds[0]) {
      setSelectedNodeId(designerSelectedNodeIds[0]);
    }
  }, [designerSelectedNodeIds]);

  // Compute matching paths
  const matchingPaths = useMemo(() => {
    if (!searchQuery) return [];
    return findMatchingPaths(documentRoot, searchQuery);
  }, [documentRoot, searchQuery]);

  const totalResults = matchingPaths.length;

  // Find the selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeById(documentRoot, selectedNodeId);
  }, [selectedNodeId, documentRoot]);

  // Reset index when search query changes
  useEffect(() => {
    setCurrentResultIndex(0);
    if (matchingPaths.length > 0) {
      setHighlightPath(matchingPaths[0] ?? null);
    } else {
      setHighlightPath(null);
    }
  }, [searchQuery, matchingPaths]);

  const handleSelectNode = (nodeId: string, jsonPath: string) => {
    setSelectedNodeId(nodeId);
    setHighlightPath(jsonPath);
  };

  const handlePathChange = (path: string | null) => {
    // When clicking in JSON, try to find the node id at that path
    if (path) {
      const nodeId = findNodeIdAtPath(documentRoot, path);
      setSelectedNodeId(nodeId);
    } else {
      setSelectedNodeId(null);
    }
    setHighlightPath(path);
  };

  const goToNextResult = useCallback(() => {
    if (totalResults === 0) return;
    const nextIndex = (currentResultIndex + 1) % totalResults;
    setCurrentResultIndex(nextIndex);
    setHighlightPath(matchingPaths[nextIndex] ?? null);
  }, [currentResultIndex, totalResults, matchingPaths]);

  const goToPreviousResult = useCallback(() => {
    if (totalResults === 0) return;
    const prevIndex = currentResultIndex === 0 ? totalResults - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    setHighlightPath(matchingPaths[prevIndex] ?? null);
  }, [currentResultIndex, totalResults, matchingPaths]);

  // Keyboard shortcuts for navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          goToPreviousResult();
        } else {
          goToNextResult();
        }
        e.preventDefault();
      }
    },
    [goToNextResult, goToPreviousResult],
  );

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 border-border border-r">
        <DevLayersPanel
          snapshot={documentRoot}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-border border-b p-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search keys and values..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 pl-8 pr-24 font-mono text-xs"
              />
              {searchQuery && (
                <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                  <span className="text-muted-foreground text-xs">
                    {totalResults > 0
                      ? `${currentResultIndex + 1} of ${totalResults}`
                      : "No results"}
                  </span>
                </div>
              )}
            </div>
            {searchQuery && totalResults > 0 && (
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onMouseDown={goToPreviousResult}
                  title="Previous result (Shift+Enter)"
                >
                  <ChevronUpIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onMouseDown={goToNextResult}
                  title="Next result (Enter)"
                >
                  <ChevronDownIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <JsonTreeViewer
            data={documentRoot}
            highlightPath={highlightPath}
            searchQuery={searchQuery}
            onPathChange={handlePathChange}
          />
        </div>
      </div>
      {/* Node Details Panel */}
      <div className="w-80 shrink-0 border-border border-l">
        <NodeDetailsPanel node={selectedNode} />
      </div>
    </div>
  );
}

// Helper to find a node id at a given JSON path
function findNodeIdAtPath(snapshot: SnapshotNode | null, path: string): string | null {
  if (!snapshot || !path) return null;

  const parts = path.split(".");
  let current: unknown = snapshot;

  // Skip "root" prefix
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (current === null || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === "object" && "id" in current) {
    return (current as SnapshotNode).id;
  }

  return null;
}
