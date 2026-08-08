import {
  AGENT_PROTOCOL_VERSION,
  type AgentClientMessage,
  type AgentServerMessage,
} from "@voidhash/agent/Protocol";
import { useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { env } from "@/lib/env";

import type { SurfaceAgent } from "./contract";
import {
  initialAgentUiState,
  reduceAgentServerMessage,
  type AgentUiFilePart,
  type AgentUiState,
  type AgentUiStatus,
} from "./agent-ui";

export interface AgentSessionIdentity {
  readonly sessionId: string;
}

type SessionAction =
  | { readonly type: "server"; readonly message: AgentServerMessage }
  | { readonly type: "status"; readonly status: AgentUiStatus; readonly error?: Error };

const reducer = (state: AgentUiState, action: SessionAction): AgentUiState =>
  action.type === "server"
    ? reduceAgentServerMessage(state, action.message)
    : {
        ...state,
        status: action.status,
        ...(action.error === undefined ? { error: undefined } : { error: action.error }),
      };

const apiBaseUrl = env.VITE_APP_API_URL.replace(/\/+$/, "");

/** Builds the authenticated WebSocket URL for a scoped durable agent session. */
export const buildAgentWebSocketUrl = (
  agent: Pick<SurfaceAgent, "surfaceId" | "context">,
  sessionId: string,
): string => {
  const url = new URL(
    `${apiBaseUrl}/api/agent/sessions/${encodeURIComponent(sessionId)}/ws`,
    globalThis.location?.origin ?? "http://localhost",
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("organizationId", agent.context.organizationId);
  url.searchParams.set("projectId", agent.context.projectId);
  url.searchParams.set("surface", agent.surfaceId);
  if (agent.context.paywallId) url.searchParams.set("paywallId", agent.context.paywallId);
  return url.toString();
};

/** Mints a portable durable-session id accepted by both runtime hosts. */
export const newAgentSessionId = (): string => `agent_${crypto.randomUUID().replaceAll("-", "")}`;

const requestId = (): string => crypto.randomUUID();

const parseServerMessage = (data: unknown): AgentServerMessage | undefined => {
  if (typeof data !== "string") return undefined;
  const parsed = Effect.runSync(
    Effect.try((): unknown => JSON.parse(data)).pipe(Effect.orElseSucceed(() => undefined)),
  );
  return typeof parsed === "object" && parsed !== null && "type" in parsed && "v" in parsed
    ? (parsed as AgentServerMessage)
    : undefined;
};

const dynamicContext = (agent: SurfaceAgent) => {
  const dynamic = agent.getDynamicContext?.() ?? {};
  const selectedNodeIds = Array.isArray(dynamic.selectedNodeIds)
    ? dynamic.selectedNodeIds.filter((value): value is string => typeof value === "string")
    : [];
  return {
    paywallId: typeof dynamic.paywallId === "string" ? dynamic.paywallId : agent.context.paywallId,
    selectedNodeIds,
  };
};

/** Connects the studio to one Pi session and exposes a small chat-compatible API. */
export function useAgentSession(agent: SurfaceAgent, session: AgentSessionIdentity) {
  const queryClient = useQueryClient();
  const [state, dispatchState] = useReducer(reducer, undefined, initialAgentUiState);
  const stateRef = useRef(state);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingFrames = useRef<string[]>([]);
  const url = useMemo(
    () => buildAgentWebSocketUrl(agent, session.sessionId),
    [agent, session.sessionId],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatch = useCallback((action: SessionAction) => {
    stateRef.current = reducer(stateRef.current, action);
    dispatchState(action);
  }, []);

  const sendCommand = useCallback((command: AgentClientMessage) => {
    const frame = JSON.stringify(command);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
    else pendingFrames.current.push(frame);
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const connect = () => {
      if (disposed) return;
      dispatch({ type: "status", status: "connecting" });
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        if (disposed || socketRef.current !== socket) return;
        attempts = 0;
        dispatch({ type: "status", status: "ready" });
        const context = dynamicContext(agent);
        const initial: AgentClientMessage[] = [
          { v: AGENT_PROTOCOL_VERSION, type: "get_entries", requestId: requestId() },
          { v: AGENT_PROTOCOL_VERSION, type: "get_state", requestId: requestId() },
          {
            v: AGENT_PROTOCOL_VERSION,
            type: "set_context",
            requestId: requestId(),
            selectedNodeIds: context.selectedNodeIds,
            ...(context.paywallId === undefined ? {} : { paywallId: context.paywallId }),
          },
        ];
        for (const command of initial) socket.send(JSON.stringify(command));
        for (const frame of pendingFrames.current.splice(0)) socket.send(frame);
      });
      socket.addEventListener("message", (event) => {
        const message = parseServerMessage(event.data);
        if (message === undefined) return;
        dispatch({ type: "server", message });
        if (message.type === "event" && message.event.type === "agent_end") {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.agentSession.list({
              organizationId: agent.context.organizationId,
              projectId: agent.context.projectId,
              surface: agent.surfaceId,
              paywallId: agent.context.paywallId,
            }),
          });
        }
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        attempts += 1;
        retry = setTimeout(connect, Math.min(5_000, 250 * 2 ** attempts));
      });
      socket.addEventListener("error", () => socket.close());
    };

    connect();
    return () => {
      disposed = true;
      if (retry !== undefined) clearTimeout(retry);
      socketRef.current?.close(1000, "Session unmounted");
      socketRef.current = null;
      pendingFrames.current = [];
    };
  }, [agent, dispatch, queryClient, url]);

  const sendMessage = useCallback(
    async (input: { readonly text?: string; readonly files?: ReadonlyArray<AgentUiFilePart> }) => {
      const text = input.text?.trim() ?? "";
      const images = (input.files ?? []).flatMap((file) =>
        file.data === undefined
          ? []
          : [{ type: "image" as const, data: file.data, mimeType: file.mediaType }],
      );
      if (text.length === 0 && images.length === 0) return;

      const context = dynamicContext(agent);
      sendCommand({
        v: AGENT_PROTOCOL_VERSION,
        type: "set_context",
        requestId: requestId(),
        selectedNodeIds: context.selectedNodeIds,
        ...(context.paywallId === undefined ? {} : { paywallId: context.paywallId }),
      });
      const isStreaming =
        stateRef.current.status === "streaming" || stateRef.current.status === "submitted";
      sendCommand({
        v: AGENT_PROTOCOL_VERSION,
        type: isStreaming ? "steer" : "prompt",
        requestId: requestId(),
        text,
        ...(images.length === 0 ? {} : { images }),
      });
      if (!isStreaming) dispatch({ type: "status", status: "submitted" });
    },
    [agent, dispatch, sendCommand],
  );

  const stop = useCallback(() => {
    sendCommand({ v: AGENT_PROTOCOL_VERSION, type: "abort", requestId: requestId() });
  }, [sendCommand]);

  const onActivityChange = agent.onActivityChange;
  useEffect(() => {
    const busy = state.status === "submitted" || state.status === "streaming";
    onActivityChange?.(
      busy ? { kind: "thinking", label: "Thinking about the paywall" } : { kind: "idle" },
    );
    return () => onActivityChange?.({ kind: "idle" });
  }, [onActivityChange, state.status]);

  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    sendMessage,
    stop,
  };
}

export type AgentSessionChat = ReturnType<typeof useAgentSession>;
