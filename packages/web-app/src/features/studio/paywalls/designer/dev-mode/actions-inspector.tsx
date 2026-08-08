"use client";

import { Button, Input } from "@voidhash/ui";
import { SearchIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { JsonTreeViewer } from "./json-tree-viewer";

interface ActionLogEntry {
  id: number;
  timestamp: Date;
  type: "snapshot" | "presence";
  description: string;
  data: unknown;
}

let actionId = 0;

export function ActionsInspector() {
  const store = usePaywallDesignerStore();
  const snapshot = useStore(store, (state) => state.mimic.snapshot);
  const presence = useStore(store, (state) => state.mimic.presence);

  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionLogEntry | null>(null);

  const prevSnapshotRef = useRef<unknown>(null);
  const prevPresenceRef = useRef<unknown>(null);
  const isInitialMount = useRef(true);

  // Track snapshot changes
  useEffect(() => {
    if (isInitialMount.current) {
      prevSnapshotRef.current = snapshot;
      return;
    }

    if (snapshot !== prevSnapshotRef.current) {
      const entry: ActionLogEntry = {
        id: ++actionId,
        timestamp: new Date(),
        type: "snapshot",
        description: "Document changed",
        data: {
          previous: prevSnapshotRef.current,
          current: snapshot,
        },
      };
      setActionLog((prev) => [entry, ...prev].slice(0, 100)); // Keep last 100
      prevSnapshotRef.current = snapshot;
    }
  }, [snapshot]);

  // Track presence changes
  useEffect(() => {
    if (isInitialMount.current) {
      prevPresenceRef.current = presence;
      isInitialMount.current = false;
      return;
    }

    if (presence !== prevPresenceRef.current) {
      const entry: ActionLogEntry = {
        id: ++actionId,
        timestamp: new Date(),
        type: "presence",
        description: "Presence updated",
        data: {
          previous: prevPresenceRef.current,
          current: presence,
        },
      };
      setActionLog((prev) => [entry, ...prev].slice(0, 100));
      prevPresenceRef.current = presence;
    }
  }, [presence]);

  const handleClearLog = useCallback(() => {
    setActionLog([]);
    setSelectedAction(null);
  }, []);

  const filteredLog = searchQuery
    ? actionLog.filter(
        (entry) =>
          entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          JSON.stringify(entry.data).toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : actionLog;

  return (
    <div className="flex h-full">
      {/* Action List */}
      <div className="flex w-80 shrink-0 flex-col border-border border-r">
        <div className="flex items-center gap-2 border-border border-b p-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleClearLog}
            title="Clear log"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredLog.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-muted-foreground text-xs">
              {actionLog.length === 0
                ? "No actions recorded yet. Make changes in the designer to see them here."
                : "No actions match your search."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLog.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`w-full p-2 text-left hover:bg-accent/50 ${
                    selectedAction?.id === entry.id ? "bg-accent" : ""
                  }`}
                  onMouseDown={() => setSelectedAction(entry)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-xs ${
                        entry.type === "snapshot"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      }`}
                    >
                      {entry.type}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-medium text-xs">{entry.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Details */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedAction ? (
          <>
            <div className="shrink-0 border-border border-b p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{selectedAction.description}</span>
                <span className="text-muted-foreground text-xs">
                  {selectedAction.timestamp.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <JsonTreeViewer data={selectedAction.data} searchQuery="" />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Select an action to view details
          </div>
        )}
      </div>
    </div>
  );
}
