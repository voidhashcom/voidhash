"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { cn, ScrollArea } from "@voidhash/ui";
import { useCallback, useRef } from "react";
import { useStore } from "zustand/react";

import { Panel } from "@/features/studio/paywalls/designer/components/ui/panel";

import { setPanelResizeActive, setRightPanelWidth } from "../state/actions/panel-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { getNodeById } from "../state/utils/nodes";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import { PANEL_DIMENSIONS } from "./constants";
import { PanelResizeHandle } from "./panel-resize-handle";
import { persistPanelWidths } from "./panel-width-storage";
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
  const dispatch = usePaywallDesignerActions();
  const isPreviewMode = useStore(store, (state) => state.mode === "preview");
  const width = useStore(store, (state) => state.viewport.panels.right.width);
  const nodes = useSelectedNodes();

  const handleResizeStart = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: true });
  }, [dispatch]);

  const handleResizeChange = useCallback(
    (nextWidth: number) => {
      dispatch(setRightPanelWidth)({ width: nextWidth });
    },
    [dispatch],
  );

  const handleResizeEnd = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: false });
    persistPanelWidths(store.getState());
  }, [dispatch, store]);

  const getWidth = useCallback(() => store.getState().viewport.panels.right.width, [store]);

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 z-40 flex flex-col border-sidebar-border border-l bg-background",
        "transition-transform duration-300 ease-in-out",
        isPreviewMode && "translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width,
      }}
    >
      <PanelResizeHandle
        edge="left"
        label="Resize properties panel"
        getWidth={getWidth}
        onWidthChange={handleResizeChange}
        onDragStart={handleResizeStart}
        onDragEnd={handleResizeEnd}
      />
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
