import { chatRequestBodySchema } from "@voidhash/ai-shared";
import { describe, expect, it, vi } from "vite-plus/test";

import type { SurfaceAgent } from "./contract";
import { buildSendMessagesBody, createVoidhashAiTransport } from "./transport";

const agent: SurfaceAgent = {
  surfaceId: "designer",
  context: { organizationId: "org_1", projectId: "proj_1", paywallId: "pw_1" },
  persistence: { chatType: "persistent" },
};

/**
 * The server now executes the agent's tools and persists the chat
 * authoritatively, so the request body must carry the `chatId` (the client-minted
 * persistence key) alongside the surface + context. `body` is protected on the
 * AI SDK transport; the test reads it structurally.
 */
describe("createVoidhashAiTransport", () => {
  it("sends surface, chatId, and the request context on the body", () => {
    const transport = createVoidhashAiTransport(agent, "ai_chat_abc");
    const body = (transport as unknown as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      surface: "designer",
      chatId: "ai_chat_abc",
      organizationId: "org_1",
      projectId: "proj_1",
      paywallId: "pw_1",
    });
  });

  it("scopes the chatId per session (distinct chat ids yield distinct bodies)", () => {
    const a = createVoidhashAiTransport(agent, "chat_a");
    const b = createVoidhashAiTransport(agent, "chat_b");
    const bodyA = (a as unknown as { body: Record<string, unknown> }).body;
    const bodyB = (b as unknown as { body: Record<string, unknown> }).body;
    expect(bodyA.chatId).toBe("chat_a");
    expect(bodyB.chatId).toBe("chat_b");
  });
});

/**
 * Cross-package wire-contract test: the body the client transport builds for a
 * send must satisfy the shared `chatRequestBodySchema` the backend route decodes
 * with. This pins the regression where a custom `prepareSendMessagesRequest`
 * dropped the SDK's `messages` from the body (the SDK sends the returned body
 * verbatim), so the server rejected the POST with 400. Building the body via the
 * SAME `buildSendMessagesBody` the transport uses keeps the two sides from
 * drifting.
 */
describe("chat request body ↔ server schema contract", () => {
  const staticBody = {
    surface: agent.surfaceId,
    chatId: "ai_chat_abc",
    ...agent.context,
  };
  const sdkFields = {
    id: "ai_chat_abc",
    messages: [{ id: "msg_1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    trigger: "submit-message" as const,
    messageId: undefined,
  };

  it("carries messages and the surface/scope fields (the SDK does NOT re-inject them)", () => {
    const body = buildSendMessagesBody(staticBody, sdkFields, {});
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.surface).toBe("designer");
    expect(body.chatId).toBe("ai_chat_abc");
    expect(body.paywallId).toBe("pw_1");
  });

  it("is accepted by the shared server schema for a designer send with selection", () => {
    const body = buildSendMessagesBody(staticBody, sdkFields, {
      selectedNodeIds: ["node_a", "node_b"],
    });
    const result = chatRequestBodySchema.safeParse(body);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.selectedNodeIds).toEqual(["node_a", "node_b"]);
    }
  });

  it("is accepted with no dynamic context (selectedNodeIds omitted)", () => {
    const body = buildSendMessagesBody(staticBody, sdkFields, {});
    expect(chatRequestBodySchema.safeParse(body).success).toBe(true);
  });

  it("is REJECTED when messages is dropped (the pre-fix bug that caused the 400)", () => {
    const { messages: _dropped, ...withoutMessages } = buildSendMessagesBody(
      staticBody,
      sdkFields,
      {},
    );
    expect(chatRequestBodySchema.safeParse(withoutMessages).success).toBe(false);
  });

  it("matches the full transport → send pipeline for a dynamic-context surface", async () => {
    const dynamicAgent: SurfaceAgent = { ...agent, getDynamicContext: () => ({ selectedNodeIds: ["n1"] }) };
    const transport = createVoidhashAiTransport(dynamicAgent, "ai_chat_abc");
    const prepare = (
      transport as unknown as {
        prepareSendMessagesRequest: (opts: {
          id: string;
          messages: unknown;
          trigger: "submit-message" | "regenerate-message";
          messageId: string | undefined;
        }) => Promise<{ body: Record<string, unknown> }>;
      }
    ).prepareSendMessagesRequest;
    // `prepareSendMessagesRequest` is async now (it awaits the surface's `beforeSend`
    // barrier before the POST), so the pipeline body is resolved.
    const { body } = await prepare(sdkFields);
    const result = chatRequestBodySchema.safeParse(body);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedNodeIds).toEqual(["n1"]);
      expect(result.data.messages).toHaveLength(1);
    }
  });

  it("awaits `beforeSend` before building the body (flush barrier)", async () => {
    const calls: string[] = [];
    const barrierAgent: SurfaceAgent = {
      ...agent,
      beforeSend: async () => {
        calls.push("beforeSend");
      },
    };
    const transport = createVoidhashAiTransport(barrierAgent, "ai_chat_abc");
    const prepare = (
      transport as unknown as {
        prepareSendMessagesRequest: (opts: typeof sdkFields) => Promise<{ body: Record<string, unknown> }>;
      }
    ).prepareSendMessagesRequest;
    const { body } = await prepare(sdkFields);
    expect(calls).toEqual(["beforeSend"]);
    expect(chatRequestBodySchema.safeParse(body).success).toBe(true);
  });

  it("sends the message even when `beforeSend` rejects (flush must not block)", async () => {
    const failingAgent: SurfaceAgent = {
      ...agent,
      beforeSend: () => Promise.reject(new Error("flush failed")),
    };
    const transport = createVoidhashAiTransport(failingAgent, "ai_chat_abc");
    const prepare = (
      transport as unknown as {
        prepareSendMessagesRequest: (opts: typeof sdkFields) => Promise<{ body: Record<string, unknown> }>;
      }
    ).prepareSendMessagesRequest;
    const { body } = await prepare(sdkFields);
    expect(chatRequestBodySchema.safeParse(body).success).toBe(true);
  });

  it("sends the message even when `beforeSend` HANGS (flush barrier times out, not blocks forever)", async () => {
    // The designer's `beforeSend` is a synchronous Monaco flush, but the transport
    // still defends against a surface whose barrier never resolves by racing it
    // against a timeout and proceeding. Fake timers keep the test instant.
    vi.useFakeTimers();
    try {
      const hangingAgent: SurfaceAgent = {
        ...agent,
        beforeSend: () => new Promise<void>(() => {}), // never resolves
      };
      const transport = createVoidhashAiTransport(hangingAgent, "ai_chat_abc");
      const prepare = (
        transport as unknown as {
          prepareSendMessagesRequest: (opts: typeof sdkFields) => Promise<{ body: Record<string, unknown> }>;
        }
      ).prepareSendMessagesRequest;
      const pending = prepare(sdkFields);
      // Advance past the barrier timeout so the send proceeds with the (stale) fork.
      await vi.advanceTimersByTimeAsync(3000);
      const { body } = await pending;
      expect(chatRequestBodySchema.safeParse(body).success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
