"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { cn, ScrollArea } from "@voidhash/ui";
import { useRef } from "react";
import { useStore } from "zustand/react";

import { Panel } from "@/features/studio/paywalls/designer/components/ui/panel";

import { usePaywallDesignerStore } from "../state/designer-store";
import { getNodeById } from "../state/utils/nodes";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import { PANEL_DIMENSIONS } from "./constants";
import { PanelStack } from "./right-panel/panel-stack";

/**
 * Shallow-compare two arrays by reference equality of elements.
 */
function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function useSelectedNodes(): SnapshotNode[] {
  const store = usePaywallDesignerStore();
  const prevRef = useRef<SnapshotNode[]>([]);

  return useStore(store, (state) => {
    const ids = selectedNodeIdsFromPresence(state.mimic.presence?.self);
    const result: SnapshotNode[] = [];
    for (const id of ids) {
      const node = getNodeById(state, id);
      if (node) result.push(node);
    }
    if (shallowArrayEqual(prevRef.current, result)) {
      return prevRef.current;
    }
    prevRef.current = result;
    return result;
  });
}

export function RightPanel() {
  const store = usePaywallDesignerStore();
  const isPreviewMode = useStore(store, (state) => state.mode === "preview");
  const nodes = useSelectedNodes();

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 z-40 flex flex-col border-border border-l bg-panel",
        "transition-transform duration-300 ease-in-out",
        isPreviewMode && "translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width: PANEL_DIMENSIONS.RIGHT_WIDTH,
      }}
    >
      <Panel className="relative overflow-hidden">
        <div className="absolute inset-0">
          <ScrollArea className="h-full">
            <div>
              {nodes.length === 0 && <div />}
              {nodes.length > 0 && <PanelStack nodes={nodes} />}
            </div>
          </ScrollArea>
        </div>
      </Panel>
    </div>
  );
}
