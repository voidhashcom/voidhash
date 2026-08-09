import type { AgentEvent, AgentMessage } from "@voidhash/agent";
import { Effect } from "effect";
import type { AgentServerMessage } from "@voidhash/agent/Protocol";
import type { SessionLogEntry } from "@voidhash/agent/SessionLog";

export interface AgentUiTextPart {
  readonly type: "text";
  readonly text: string;
}

export interface AgentUiReasoningPart {
  readonly type: "reasoning";
  readonly text: string;
}

export interface AgentUiFilePart {
  readonly type: "file";
  readonly data?: string;
  readonly filename?: string;
  readonly mediaType: string;
  readonly url: string;
}

export interface AgentUiNoticePart {
  readonly type: "notice";
  readonly tone: "error" | "warning";
  readonly text: string;
}

export type AgentUiToolState =
  | "input-streaming"
  | "input-available"
  | "running"
  | "output-available"
  | "output-error";

export interface AgentUiToolPart {
  readonly type: "tool";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly state: AgentUiToolState;
  readonly input: unknown;
  readonly output?: unknown;
  readonly details?: unknown;
  readonly errorText?: string;
}

export type AgentUiPart =
  | AgentUiTextPart
  | AgentUiReasoningPart
  | AgentUiFilePart
  | AgentUiNoticePart
  | AgentUiToolPart;

export interface AgentUiMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly timestamp: number;
  readonly parts: ReadonlyArray<AgentUiPart>;
}

export type AgentUiStatus = "connecting" | "ready" | "submitted" | "streaming" | "error";

export interface AgentUiState {
  readonly messages: ReadonlyArray<AgentUiMessage>;
  readonly status: AgentUiStatus;
  readonly error?: Error;
}

/** Initial local state for a newly mounted durable agent session. */
export const initialAgentUiState = (): AgentUiState => ({
  messages: [],
  status: "connecting",
});

const dataUrl = (mimeType: string, data: string): string =>
  data.startsWith("data:") ? data : `data:${mimeType};base64,${data}`;

const messageId = (message: { readonly role: string; readonly timestamp: number }): string =>
  `${message.role}-${message.timestamp}`;

const formatUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  return Effect.runSync(
    Effect.try(() => JSON.stringify(value) ?? String(value)).pipe(
      Effect.orElseSucceed(() => String(value)),
    ),
  );
};

const toolResultOutput = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null || !("content" in value)) return value;
  const content = value.content;
  if (!Array.isArray(content)) return value;
  if (
    content.some(
      (item) =>
        typeof item === "object" && item !== null && "type" in item && item.type === "image",
    )
  ) {
    return content;
  }
  const text = content
    .filter(
      (item): item is { readonly type: "text"; readonly text: string } =>
        typeof item === "object" &&
        item !== null &&
        item.type === "text" &&
        typeof item.text === "string",
    )
    .map((item) => item.text)
    .join("\n");
  return text.length > 0 ? text : content;
};

const messageToUi = (message: AgentMessage): AgentUiMessage | undefined => {
  if (message.role === "user") {
    const content = Array.isArray(message.content)
      ? message.content
      : [{ type: "text" as const, text: message.content }];
    return {
      id: messageId(message),
      role: "user",
      timestamp: message.timestamp,
      parts: content.map(
        (part): AgentUiPart =>
          part.type === "image"
            ? {
                type: "file",
                data: part.data,
                filename: "attachment",
                mediaType: part.mimeType,
                url: dataUrl(part.mimeType, part.data),
              }
            : { type: "text", text: part.text },
      ),
    };
  }
  if (message.role !== "assistant") return undefined;
  const notice: AgentUiNoticePart | undefined =
    message.stopReason === "error"
      ? {
          type: "notice",
          tone: "error",
          text: message.errorMessage ?? "The model failed before completing this response.",
        }
      : message.stopReason === "length"
        ? {
            type: "notice",
            tone: "warning",
            text: "The response was truncated because the model reached its output limit.",
          }
        : message.stopReason === "aborted"
          ? { type: "notice", tone: "warning", text: "The response was stopped." }
          : undefined;
  return {
    id: messageId(message),
    role: "assistant",
    timestamp: message.timestamp,
    parts: [
      ...message.content.map((part): AgentUiPart => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (part.type === "thinking") return { type: "reasoning", text: part.thinking };
        return {
          type: "tool",
          toolCallId: part.id,
          toolName: part.name,
          state: "input-available",
          input: part.arguments,
        };
      }),
      ...(notice === undefined ? [] : [notice]),
    ],
  };
};

const mergeMessage = (
  existing: AgentUiMessage | undefined,
  next: AgentUiMessage,
): AgentUiMessage => {
  if (existing === undefined || next.role !== "assistant") return next;
  return {
    ...next,
    parts: next.parts.map((part) => {
      if (part.type !== "tool") return part;
      const prior = existing.parts.find(
        (candidate): candidate is AgentUiToolPart =>
          candidate.type === "tool" && candidate.toolCallId === part.toolCallId,
      );
      return prior === undefined
        ? part
        : {
            ...part,
            state: prior.state,
            ...(prior.output === undefined ? {} : { output: prior.output }),
            ...(prior.details === undefined ? {} : { details: prior.details }),
            ...(prior.errorText === undefined ? {} : { errorText: prior.errorText }),
          };
    }),
  };
};

const upsertMessage = (
  messages: ReadonlyArray<AgentUiMessage>,
  message: AgentUiMessage,
): ReadonlyArray<AgentUiMessage> => {
  const index = messages.findIndex((candidate) => candidate.id === message.id);
  if (index < 0) return [...messages, message];
  const copy = [...messages];
  copy[index] = mergeMessage(copy[index], message);
  return copy;
};

const updateTool = (
  messages: ReadonlyArray<AgentUiMessage>,
  toolCallId: string,
  update: (part: AgentUiToolPart) => AgentUiToolPart,
): ReadonlyArray<AgentUiMessage> => {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message?.role !== "assistant") continue;
    const partIndex = message.parts.findIndex(
      (part) => part.type === "tool" && part.toolCallId === toolCallId,
    );
    if (partIndex < 0) continue;
    const part = message.parts[partIndex];
    if (part?.type !== "tool") return messages;
    const parts = [...message.parts];
    parts[partIndex] = update(part);
    const copy = [...messages];
    copy[messageIndex] = { ...message, parts };
    return copy;
  }
  return messages;
};

const applyToolResult = (
  messages: ReadonlyArray<AgentUiMessage>,
  result: {
    readonly toolCallId: string;
    readonly isError: boolean;
    readonly content: unknown;
    readonly details?: unknown;
  },
): ReadonlyArray<AgentUiMessage> =>
  updateTool(messages, result.toolCallId, (part) => {
    const output = toolResultOutput({ content: result.content });
    return result.isError
      ? {
          ...part,
          state: "output-error",
          ...(result.details === undefined ? {} : { details: result.details }),
          errorText: formatUnknown(output),
        }
      : {
          ...part,
          state: "output-available",
          output,
          ...(result.details === undefined ? {} : { details: result.details }),
        };
  });

const reduceAgentEvent = (state: AgentUiState, event: AgentEvent): AgentUiState => {
  switch (event.type) {
    case "agent_start":
    case "turn_start":
      return { ...state, status: "streaming", error: undefined };
    case "agent_end":
      return { ...state, status: "ready" };
    case "message_start":
    case "message_update":
    case "message_end": {
      if (event.message.role === "toolResult") {
        return { ...state, messages: applyToolResult(state.messages, event.message) };
      }
      const message = messageToUi(event.message);
      return message === undefined
        ? state
        : { ...state, messages: upsertMessage(state.messages, message) };
    }
    case "tool_execution_start":
      return {
        ...state,
        messages: updateTool(state.messages, event.toolCallId, (part) => ({
          ...part,
          input: event.args,
          state: "running",
        })),
      };
    case "tool_execution_update":
      return {
        ...state,
        messages: updateTool(state.messages, event.toolCallId, (part) => ({
          ...part,
          output: toolResultOutput(event.partialResult),
          state: "running",
        })),
      };
    case "tool_execution_end":
      return {
        ...state,
        messages: updateTool(state.messages, event.toolCallId, (part) => {
          const output = toolResultOutput(event.result);
          const details =
            typeof event.result === "object" && event.result !== null && "details" in event.result
              ? event.result.details
              : undefined;
          return event.isError
            ? {
                ...part,
                state: "output-error",
                ...(details === undefined ? {} : { details }),
                errorText: formatUnknown(output),
              }
            : {
                ...part,
                state: "output-available",
                output,
                ...(details === undefined ? {} : { details }),
              };
        }),
      };
    case "turn_end": {
      const message = messageToUi(event.message);
      let messages =
        message === undefined ? state.messages : upsertMessage(state.messages, message);
      for (const result of event.toolResults) messages = applyToolResult(messages, result);
      return { ...state, messages };
    }
  }
};

/** Reconstructs renderable chat messages from persisted Pi session entries. */
export const messagesFromAgentEntries = (
  entries: ReadonlyArray<unknown>,
): ReadonlyArray<AgentUiMessage> => {
  let messages: ReadonlyArray<AgentUiMessage> = [];
  for (const value of entries) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("type" in value) ||
      value.type !== "message" ||
      !("message" in value)
    ) {
      continue;
    }
    const entry = value as SessionLogEntry;
    if (entry.type !== "message") continue;
    if (entry.message.role === "toolResult") {
      messages = applyToolResult(messages, entry.message);
      continue;
    }
    const message = messageToUi(entry.message);
    if (message !== undefined) messages = upsertMessage(messages, message);
  }
  return messages;
};

/** Folds one typed server frame into the transport-neutral chat view model. */
export const reduceAgentServerMessage = (
  state: AgentUiState,
  message: AgentServerMessage,
): AgentUiState => {
  switch (message.type) {
    case "event":
      return reduceAgentEvent(state, message.event);
    case "entries": {
      let messages = messagesFromAgentEntries(message.entries);
      for (const current of state.messages) messages = upsertMessage(messages, current);
      return { ...state, messages };
    }
    case "state":
      return { ...state, status: message.state.isStreaming ? "streaming" : "ready" };
    case "error":
      return { ...state, error: new Error(message.message), status: "error" };
    case "ack":
      return state;
  }
};
