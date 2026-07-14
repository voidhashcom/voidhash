import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";

import { queryKeys } from "@/features/studio/lib/tanstack-query";

import type { SurfaceAgent } from "./contract";
import { createVoidhashAiTransport } from "./transport";

/** Identity for one chat session. The id is minted client-side so attachments can be uploaded before the first save. */
export interface SurfaceChatSession {
  readonly chatId: string;
  /** Seed messages when reopening a stored chat; omit/empty for a new chat. */
  readonly initialMessages?: UIMessage[];
}

/** Mint a fresh client-side chat id (fits the 64-char id column with room to spare). */
export const newChatId = (): string => `ai_chat_${crypto.randomUUID().replace(/-/g, "")}`;

/**
 * Safety cap on client-tool auto-continuations for a single user turn. The
 * backend already caps server steps with a `stepCountIs` backstop; this guards
 * the CLIENT loop so a model that keeps calling tools without ever producing a
 * final answer cannot round-trip forever. Reset when the user sends a new
 * message (the count only bounds an in-flight agentic turn).
 */
const MAX_AUTO_CONTINUATIONS = 64;

/**
 * Surface-agnostic chat hook. Wraps the AI SDK `useChat` with the Voidhash
 * transport.
 *
 * When the agent exposes {@link SurfaceAgent.executeTool}, its tools are
 * CLIENT-EXECUTED: the backend declares them schema-only, so the model calling a
 * tool ends the stream; this hook runs the executor via `onToolCall`, feeds the
 * result back with `addToolResult`, and auto-continues via
 * `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` (bounded by
 * {@link MAX_AUTO_CONTINUATIONS}). A surface with no `executeTool` is a pure chat
 * UI (server-only tools or none) and never auto-continues.
 *
 * Persistence is server-authoritative (the server upserts the full transcript in
 * the stream's `onFinish`), so this hook only invalidates the cached history on
 * finish so the dropdown refetches the server's freshly-persisted list/snapshot.
 *
 * A session is identified by `session.chatId`; hosts remount this hook (keyed by
 * chatId) to switch between a new chat and a reopened one.
 */
export function useSurfaceChat(agent: SurfaceAgent, session: SurfaceChatSession) {
  const queryClient = useQueryClient();
  const { chatId } = session;

  const transport = useMemo(() => createVoidhashAiTransport(agent, chatId), [agent, chatId]);

  const { organizationId, projectId, paywallId } = agent.context;
  const surface = agent.surfaceId;

  const executeTool = agent.executeTool;
  // Bound the client auto-continuation loop. A ref (not state) so it does not
  // re-render; the `sendAutomaticallyWhen` closure reads the live count.
  const continuationsRef = useRef(0);

  const chat = useChat({
    id: chatId,
    messages: session.initialMessages,
    transport,
    // Execute a client tool call and feed its result back. The executor folds
    // every failure into `{ output, isError }`, so this never throws into the SDK.
    onToolCall:
      executeTool === undefined
        ? undefined
        : async ({ toolCall }) => {
            // The current user turn = the last user message; threaded so the
            // designer's `apply_changes` can capture a per-turn server checkpoint.
            const turnId = [...chat.messages].reverse().find((m) => m.role === "user")?.id;
            const result = await executeTool({
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              input: toolCall.input,
              chatId,
              turnId,
            });
            chat.addToolResult({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: result.output,
            });
          },
    // Auto-continue the conversation once the assistant's turn is complete with
    // client tool results, bounded so a runaway tool loop cannot spin forever.
    sendAutomaticallyWhen:
      executeTool === undefined
        ? undefined
        : ({ messages }) => {
            if (continuationsRef.current >= MAX_AUTO_CONTINUATIONS) {
              return false;
            }
            if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) {
              return false;
            }
            continuationsRef.current += 1;
            return true;
          },
    onFinish: ({ isError, isAbort }) => {
      // The server persisted the transcript authoritatively; just refresh the
      // client history caches so the dropdown and any reopened snapshot are fresh.
      if (isError || isAbort || !organizationId || !projectId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiChat.list({ organizationId, projectId, surface, paywallId }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiChat.get(chatId) });
    },
  });

  const {
    messages,
    sendMessage: rawSendMessage,
    status,
    error,
    stop,
    regenerate: rawRegenerate,
  } = chat;

  const onActivityChange = agent.onActivityChange;
  useEffect(() => {
    onActivityChange?.(
      status === "submitted" || status === "streaming"
        ? { kind: "thinking", label: "Thinking about the paywall" }
        : { kind: "idle" },
    );
    return () => onActivityChange?.({ kind: "idle" });
  }, [onActivityChange, status]);

  // Wrap `sendMessage` so a fresh USER turn resets the auto-continuation budget
  // (the cap bounds one agentic turn, not the whole chat).
  const sendMessage = useMemo(
    () =>
      ((...args: Parameters<typeof rawSendMessage>) => {
        continuationsRef.current = 0;
        return rawSendMessage(...args);
      }) as typeof rawSendMessage,
    [rawSendMessage],
  );

  // Regenerating a turn is a fresh agentic turn too, so reset the budget.
  const regenerate = useMemo(
    () =>
      ((...args: Parameters<typeof rawRegenerate>) => {
        continuationsRef.current = 0;
        return rawRegenerate(...args);
      }) as typeof rawRegenerate,
    [rawRegenerate],
  );

  return { messages, sendMessage, status, error, stop, regenerate };
}

export type SurfaceChat = ReturnType<typeof useSurfaceChat>;
