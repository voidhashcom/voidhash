import { Agent, type AgentMessage, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import { DurableEntityHost } from "@orbian/sdk/DurableEntity";
import { makeNodeDurableEntitySession } from "@orbian/node/NodeDurableEntitySession";
import {
  PgDurableEntityHostLive,
  type PgDurableEntityConfig,
} from "@orbian/node/DurableEntity";
import { Effect, ManagedRuntime, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentSessionCore,
  agentSessionAddress,
  type AgentSessionConnection,
} from "../src/AgentSessionCore.ts";
import { readSessionLogCount } from "../src/SessionLog.ts";

const config: PgDurableEntityConfig = {
  host: process.env.PLATFORM_NODE_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_NODE_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_NODE_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_NODE_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_NODE_PG_PASSWORD ?? "password"),
};

const model: Model<string> = {
  id: "pg-test-model",
  name: "Postgres test model",
  api: "test",
  provider: "test-provider",
  baseUrl: "https://example.invalid",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 10_000,
  maxTokens: 1_000,
};

const assistantMessage = (): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text: "postgres-host-ok" }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: Date.now(),
});

const streamFn: StreamFn = () => {
  const stream = createAssistantMessageEventStream();
  const message = assistantMessage();
  queueMicrotask(() => {
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({
      type: "text_start",
      contentIndex: 0,
      partial: { ...message, content: [{ type: "text", text: "" }] },
    });
    stream.push({
      type: "text_delta",
      contentIndex: 0,
      delta: "postgres-host-ok",
      partial: message,
    });
    stream.push({
      type: "text_end",
      contentIndex: 0,
      content: "postgres-host-ok",
      partial: message,
    });
    stream.push({ type: "done", reason: "stop", message });
  });
  return stream;
};

const waitFor = async (predicate: () => Promise<boolean> | boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the Postgres agent session");
};

const describePg = process.env.PLATFORM_NODE_PG_TEST === "1" ? describe : describe.skip;

describePg("AgentSessionCore on PgDurableEntityHostLive", () => {
  it("persists a turn and rehydrates it after the host runtime restarts", async () => {
    const sessionId = `agent-pg-${crypto.randomUUID()}`;
    const owner = {
      organizationId: "organization-pg",
      projectId: "project-pg",
      userId: "user-pg",
    };
    const firstRuntime = ManagedRuntime.make(PgDurableEntityHostLive(config));
    const firstHost = await firstRuntime.runPromise(DurableEntityHost);
    const frames: string[] = [];
    const firstConnection: AgentSessionConnection = {
      sessionId,
      owner,
      data: undefined,
      session: makeNodeDurableEntitySession("connection-1", {
        send: (frame) => frames.push(String(frame)),
        close: () => undefined,
      }),
    };
    const firstCore = new AgentSessionCore({
      host: firstHost,
      factory: {
        create: ({ messages }) =>
          new Agent({
            initialState: { model, messages: [...messages], tools: [] },
            streamFn,
          }),
        resolveModel: () => model,
      },
    });

    try {
      await expect(Effect.runPromise(firstCore.connect(firstConnection))).resolves.toBe(true);
      await Effect.runPromise(
        firstCore.handleMessage(
          firstConnection,
          JSON.stringify({
            v: 1,
            type: "prompt",
            requestId: "prompt-pg",
            text: "persist this turn",
          }),
        ),
      );
      await waitFor(
        async () =>
          (await Effect.runPromise(
            readSessionLogCount(firstHost, agentSessionAddress(sessionId)),
          )) === 2,
      );
    } finally {
      await firstRuntime.dispose();
    }

    const secondRuntime = ManagedRuntime.make(PgDurableEntityHostLive(config));
    const secondHost = await secondRuntime.runPromise(DurableEntityHost);
    let restoredMessages: ReadonlyArray<AgentMessage> = [];
    const secondConnection: AgentSessionConnection = {
      sessionId,
      owner,
      data: undefined,
      session: makeNodeDurableEntitySession("connection-2", {
        send: () => undefined,
        close: () => undefined,
      }),
    };
    const secondCore = new AgentSessionCore({
      host: secondHost,
      factory: {
        create: ({ messages }) => {
          restoredMessages = messages;
          return new Agent({ initialState: { model, messages: [...messages], tools: [] } });
        },
        resolveModel: () => model,
      },
    });

    try {
      await expect(Effect.runPromise(secondCore.connect(secondConnection))).resolves.toBe(true);
      await Effect.runPromise(
        secondCore.handleMessage(
          secondConnection,
          JSON.stringify({ v: 1, type: "get_state", requestId: "state-pg" }),
        ),
      );
      expect(restoredMessages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(frames.some((frame) => frame.includes("postgres-host-ok"))).toBe(true);
    } finally {
      await secondRuntime.dispose();
    }
  });
});
