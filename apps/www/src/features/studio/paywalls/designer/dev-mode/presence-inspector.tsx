"use client";

import { Input } from "@voidhash/ui";
import { SearchIcon, UserIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { JsonTreeViewer } from "./json-tree-viewer";

export function PresenceInspector() {
  const store = usePaywallDesignerStore();
  const self = useStore(store, (state) => state.mimic.presence?.self);
  const others = useStore(store, (state) => state.mimic.presence?.others);

  const [searchQuery, setSearchQuery] = useState("");

  // Convert Map to array for display
  const othersArray = useMemo(() => {
    if (!others) return [];
    return Array.from(others.entries()).map(([id, entry]) => ({
      id,
      ...entry,
    }));
  }, [others]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-border border-b p-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search presence data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Current User Section */}
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <UserIcon className="size-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Current User (self)</span>
              {self?.user && (
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: self.user.color }}
                />
              )}
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <JsonTreeViewer data={self} searchQuery={searchQuery} />
            </div>
          </div>

          {/* Other Users Section */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Other Users ({othersArray.length})</span>
            </div>
            {othersArray.length > 0 ? (
              <div className="space-y-3">
                {othersArray.map((other) => (
                  <div key={other.id} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="mb-2 flex items-center gap-2">
                      {other.data?.user && (
                        <>
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: other.data.user.color }}
                          />
                          <span className="font-medium text-xs">{other.data.user.name}</span>
                        </>
                      )}
                    </div>
                    <JsonTreeViewer data={other} searchQuery={searchQuery} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-center text-muted-foreground text-xs">
                No other users connected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
