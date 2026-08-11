"use client";

import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { cn } from "@voidhash/ui";
import { useCallback, useState } from "react";
import { useStore } from "zustand/react";

import { ChatHistoryMenu, ChatShell, newAgentSessionId } from "@/features/studio/ai";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";

import { Panel } from "../components/ui/panel";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { PanelResizeHandle } from "../panels/panel-resize-handle";
import { persistPanelWidths } from "../panels/panel-width-storage";
import { setAiPanelWidth, setAiWorking } from "../state/actions/ai-panel-actions";
import { setPanelResizeActive } from "../state/actions/panel-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { useDesignerAgent } from "./use-designer-agent";

interface ChatSession {
  chatId: string;
}

/**
 * Fixed overlay panel hosting the Voidhash AI chat, anchored to the left edge
 * below the top panel. Visible in design and code modes; slides out (via
 * `-translate-x-full`) when closed or while in preview mode. Gated behind the
 * `voidhash_ai_pi` internal feature flag so the store slice stays inert when off.
 *
 * The panel is closed from the top bar (its Sparkles toggle), so the header
 * carries only the "new chat" and history controls; document reverting is
 * handled elsewhere.
 */
export function AiPanel() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const agent = useDesignerAgent();

  const enabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidhashAiPi.key);
  const panelOpen = useStore(store, (state) => state.ai.panelOpen);
  const mode = useStore(store, (state) => state.mode);
  const width = useStore(store, (state) => state.ai.width);
  const isPreviewMode = mode === "preview";

  // Current session identity; changing it remounts the WebSocket-backed shell.
  const [session, setSession] = useState<ChatSession>(() => ({
    chatId: newAgentSessionId(),
  }));

  const handleResizeStart = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: true });
  }, [dispatch]);

  const handleResizeChange = useCallback(
    (nextWidth: number) => {
      dispatch(setAiPanelWidth)({ width: nextWidth });
    },
    [dispatch],
  );

  const handleResizeEnd = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: false });
    persistPanelWidths(store.getState());
  }, [dispatch, store]);

  const getWidth = useCallback(() => store.getState().ai.width, [store]);

  const handleBusyChange = useCallback(
    (isWorking: boolean) => {
      dispatch(setAiWorking)({ isWorking });
    },
    [dispatch],
  );

  if (!enabled) {
    return null;
  }

  const hidden = !panelOpen || isPreviewMode;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 z-40 flex flex-col border-sidebar-border border-r bg-background",
        "transition-transform duration-300 ease-in-out",
        hidden && "-translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width,
      }}
    >
      <PanelResizeHandle
        edge="right"
        label="Resize AI panel"
        getWidth={getWidth}
        onWidthChange={handleResizeChange}
        onDragStart={handleResizeStart}
        onDragEnd={handleResizeEnd}
      />
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-medium text-sm">Voidhash AI</span>
          <ChatHistoryMenu
            agent={agent}
            currentChatId={session.chatId}
            onNewChat={() => setSession({ chatId: newAgentSessionId() })}
            onSelectChat={(chatId) => setSession({ chatId })}
          />
        </div>
        <ChatShell
          key={session.chatId}
          agent={agent}
          chatId={session.chatId}
          onBusyChange={handleBusyChange}
          className="min-h-0 flex-1"
        />
      </Panel>
    </div>
  );
}
