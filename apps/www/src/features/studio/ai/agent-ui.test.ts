import type { AgentServerMessage } from "@voidhash/agent/Protocol";
import { describe, expect, it } from "vitest";

import {
  initialAgentUiState,
  messagesFromAgentEntries,
  reduceAgentServerMessage,
} from "./agent-ui";

const usage = {
  input: 1,
  output: 1,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

describe("agent UI event fold", () => {
  it("reconstructs user, assistant, and completed tool parts from session entries", () => {
    const entries = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        timestamp: 1,
        message: { role: "user", content: "Build a paywall", timestamp: 10 },
      },
      {
        type: "message",
        id: "entry-2",
        parentId: "entry-1",
        timestamp: 2,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "I’ll edit it." },
            {
              type: "toolCall",
              id: "call-1",
              name: "edit_paywall",
              arguments: { slug: "onboarding" },
            },
          ],
          api: "openai-completions",
          provider: "cloudflare-workers-ai",
          model: "model",
          usage,
          stopReason: "toolUse",
          timestamp: 20,
        },
      },
      {
        type: "message",
        id: "entry-3",
        parentId: "entry-2",
        timestamp: 3,
        message: {
          role: "toolResult",
          toolCallId: "call-1",
          toolName: "edit_paywall",
          content: [{ type: "text", text: "Updated" }],
          details: { editSessionId: "change-1" },
          isError: false,
          timestamp: 21,
        },
      },
    ];

    const messages = messagesFromAgentEntries(entries);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.parts).toContainEqual(
      expect.objectContaining({
        type: "tool",
        toolName: "edit_paywall",
        state: "output-available",
        output: "Updated",
        details: { editSessionId: "change-1" },
      }),
    );
  });

  it("folds streamed text and tool execution lifecycle events", () => {
    const assistant = {
      role: "assistant" as const,
      content: [
        { type: "text" as const, text: "Working" },
        {
          type: "toolCall" as const,
          id: "call-1",
          name: "get_paywall",
          arguments: { slug: "main" },
        },
      ],
      api: "openai-completions",
      provider: "cloudflare-workers-ai",
      model: "model",
      usage,
      stopReason: "toolUse" as const,
      timestamp: 30,
    };
    const frames = [
      { v: 1, type: "event", event: { type: "agent_start" } },
      {
        v: 1,
        type: "event",
        event: {
          type: "message_update",
          message: assistant,
          assistantMessageEvent: { type: "done", reason: "toolUse", message: assistant },
        },
      },
      {
        v: 1,
        type: "event",
        event: {
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "get_paywall",
          args: { slug: "main" },
        },
      },
      {
        v: 1,
        type: "event",
        event: {
          type: "tool_execution_end",
          toolCallId: "call-1",
          toolName: "get_paywall",
          result: { content: [{ type: "text", text: "Found" }] },
          isError: false,
        },
      },
      { v: 1, type: "event", event: { type: "agent_end", messages: [] } },
    ] as unknown as AgentServerMessage[];

    const state = frames.reduce(reduceAgentServerMessage, initialAgentUiState());
    expect(state.status).toBe("ready");
    expect(state.messages[0]?.parts).toEqual([
      { type: "text", text: "Working" },
      expect.objectContaining({
        type: "tool",
        state: "output-available",
        output: "Found",
      }),
    ]);
  });

  it("preserves edit-session details when a workspace tool reports an expected error", () => {
    const assistant = {
      role: "assistant" as const,
      content: [
        {
          type: "toolCall" as const,
          id: "call-1",
          name: "edit_paywall",
          arguments: { slug: "main" },
        },
      ],
      api: "openai-completions",
      provider: "cloudflare-workers-ai",
      model: "model",
      usage,
      stopReason: "toolUse" as const,
      timestamp: 30,
    };
    const frames = [
      {
        v: 1,
        type: "event",
        event: {
          type: "message_update",
          message: assistant,
          assistantMessageEvent: { type: "done", reason: "toolUse", message: assistant },
        },
      },
      {
        v: 1,
        type: "event",
        event: {
          type: "tool_execution_end",
          toolCallId: "call-1",
          toolName: "edit_paywall",
          result: {
            content: [{ type: "text", text: "The edit conflicted." }],
            details: { editSessionId: "change-1" },
          },
          isError: true,
        },
      },
    ] as unknown as AgentServerMessage[];

    const state = frames.reduce(reduceAgentServerMessage, initialAgentUiState());
    expect(state.messages[0]?.parts).toContainEqual(
      expect.objectContaining({
        type: "tool",
        state: "output-error",
        errorText: "The edit conflicted.",
        details: { editSessionId: "change-1" },
      }),
    );
  });

  it("preserves image tool results for rendering", () => {
    const entries = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        timestamp: 1,
        message: {
          role: "assistant",
          content: [{ type: "toolCall", id: "call-1", name: "preview", arguments: {} }],
          api: "openai-completions",
          provider: "cloudflare-workers-ai",
          model: "model",
          usage,
          stopReason: "toolUse",
          timestamp: 20,
        },
      },
      {
        type: "message",
        id: "entry-2",
        parentId: "entry-1",
        timestamp: 2,
        message: {
          role: "toolResult",
          toolCallId: "call-1",
          toolName: "preview",
          content: [
            { type: "text", text: "Rendered preview" },
            { type: "image", data: "aW1hZ2U=", mimeType: "image/png" },
          ],
          isError: false,
          timestamp: 21,
        },
      },
    ];

    const messages = messagesFromAgentEntries(entries);
    expect(messages[0]?.parts).toContainEqual(
      expect.objectContaining({
        type: "tool",
        state: "output-available",
        output: [
          { type: "text", text: "Rendered preview" },
          { type: "image", data: "aW1hZ2U=", mimeType: "image/png" },
        ],
      }),
    );
  });

  it("surfaces model failures and output truncation", () => {
    const makeAssistant = (stopReason: "error" | "length", errorMessage?: string) => ({
      type: "message",
      id: stopReason,
      parentId: null,
      timestamp: 1,
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Partial" }],
        api: "openai-completions",
        provider: "cloudflare-workers-ai",
        model: "model",
        usage,
        stopReason,
        errorMessage,
        timestamp: stopReason === "error" ? 20 : 21,
      },
    });

    const messages = messagesFromAgentEntries([
      makeAssistant("error", "Provider unavailable"),
      makeAssistant("length"),
    ]);
    expect(messages[0]?.parts).toContainEqual({
      type: "notice",
      tone: "error",
      text: "Provider unavailable",
    });
    expect(messages[1]?.parts).toContainEqual(
      expect.objectContaining({ type: "notice", tone: "warning" }),
    );
  });
});
