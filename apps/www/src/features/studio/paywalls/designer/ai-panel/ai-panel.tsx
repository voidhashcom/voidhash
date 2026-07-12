"use client";

import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { cn } from "@voidhash/ui";
import type { UIMessage } from "ai";
import { useCallback, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { ChatHistoryMenu, ChatShell, newChatId } from "@/features/studio/ai";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";

import { Panel } from "../components/ui/panel";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { setAiPanelWidth } from "../state/actions/ai-panel-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { useDesignerAgent } from "./use-designer-agent";

interface ChatSession {
  chatId: string;
  initialMessages?: UIMessage[];
}

/**
 * Fixed overlay panel hosting the Voidhash AI chat, anchored to the left edge
 * below the top panel. Visible in design and code modes; slides out (via
 * `-translate-x-full`) when closed or while in preview mode. Gated behind the
 * `voidhash_ai` internal feature flag so the store slice stays inert when off.
 *
 * The panel is closed from the top bar (its Sparkles toggle), so the header
 * carries only the "new chat" and history controls; document reverting is
 * handled elsewhere.
 */
export function AiPanel() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const agent = useDesignerAgent();

  const enabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidhashAi.key);
  const panelOpen = useStore(store, (state) => state.ai.panelOpen);
  const mode = useStore(store, (state) => state.mode);
  const width = useStore(store, (state) => state.ai.width);
  const isPreviewMode = mode === "preview";

  // Current chat identity; changing chatId remounts the shell (fresh useChat).
  const [session, setSession] = useState<ChatSession>(() => ({ chatId: newChatId() }));

  // Drag-to-resize: capture the pointer on the right-edge handle and translate
  // horizontal movement into width updates (clamped by the setter). Held in a
  // ref so the move handler reads the drag origin without re-subscribing.
  const dragOrigin = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragOrigin.current = { startX: event.clientX, startWidth: store.getState().ai.width };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [store],
  );

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOrigin.current;
      if (!origin) return;
      dispatch(setAiPanelWidth)({ width: origin.startWidth + (event.clientX - origin.startX) });
    },
    [dispatch],
  );

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    dragOrigin.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  if (!enabled) {
    return null;
  }

  const hidden = !panelOpen || isPreviewMode;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 z-40 flex flex-col border-border border-r bg-panel",
        "transition-transform duration-300 ease-in-out",
        hidden && "-translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width,
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI panel"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
      >
        <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-primary" />
      </div>
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-medium text-sm">Voidhash AI</span>
          <ChatHistoryMenu
            agent={agent}
            currentChatId={session.chatId}
            onNewChat={() => setSession({ chatId: newChatId() })}
            onSelectChat={(chatId, messages) => setSession({ chatId, initialMessages: messages })}
          />
        </div>
        <ChatShell
          key={session.chatId}
          agent={agent}
          chatId={session.chatId}
          initialMessages={session.initialMessages}
          className="min-h-0 flex-1"
        />
      </Panel>
    </div>
  );
}
