import { Agent, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context as PiContext,
  type Model,
} from "@earendil-works/pi-ai";
import { makeMemoryDurableEntityHost } from "@orbian/node/MemoryDurableEntity";
import { makeNodeDurableEntitySession } from "@orbian/node/NodeDurableEntitySession";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentSessionCore,
  agentSessionAddress,
  type AgentSessionConnection,
} from "../src/AgentSessionCore.ts";
import { readSessionLog } from "../src/SessionLog.ts";

const model: Model<string> = {
  id: "test-model",
  name: "Test model",
  api: "test",
  provider: "test-provider",
  baseUrl: "https://example.invalid",
  reasoning: false,
  input: ["text", "image"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 10_000,
  maxTokens: 1_000,
};

const alternateModel: Model<string> = {
  ...model,
  id: "alternate-model",
  name: "Alternate model",
};

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const assistantMessage = (text: string): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage,
  stopReason: "stop",
  timestamp: Date.now(),
});

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for condition");
};

interface TestConnectionData {
  readonly token: string;
}

const owner = { organizationId: "org", projectId: "project", userId: "user" };

describe("AgentSessionCore", () => {
  it("streams, persists, rehydrates, and accepts steering while a turn is active", async () => {
    const host = makeMemoryDurableEntityHost();
    const frames: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => void (releaseFirst = resolve));
    const contexts: PiContext[] = [];
    let streamCalls = 0;

    const streamFn: StreamFn = (_model, context) => {
      contexts.push(context);
      streamCalls += 1;
      const call = streamCalls;
      const stream = createAssistantMessageEventStream();
      void (async () => {
        if (call === 1) await firstGate;
        const message = assistantMessage(call === 1 ? "first" : "steered");
        stream.push({ type: "start", partial: { ...message, content: [] } });
        stream.push({
          type: "text_start",
          contentIndex: 0,
          partial: { ...message, content: [{ type: "text", text: "" }] },
        });
        stream.push({
          type: "text_delta",
          contentIndex: 0,
          delta: message.content[0]?.type === "text" ? message.content[0].text : "",
          partial: message,
        });
        stream.push({
          type: "text_end",
          contentIndex: 0,
          content: message.content[0]?.type === "text" ? message.content[0].text : "",
          partial: message,
        });
        stream.push({ type: "done", reason: "stop", message });
      })();
      return stream;
    };

    const core = new AgentSessionCore<TestConnectionData>({
      host,
      idleTimeoutMs: 100,
      factory: {
        create: ({ messages }) =>
          new Agent({
            initialState: {
              model,
              messages: [...messages],
              systemPrompt: "test",
              tools: [],
            },
            streamFn,
          }),
        resolveModel: (provider, modelId) =>
          provider === model.provider && modelId === model.id ? model : undefined,
      },
    });
    const durableSession = makeNodeDurableEntitySession("connection-1", {
      send: (frame) => frames.push(String(frame)),
      close: () => undefined,
    });
    const connection: AgentSessionConnection<TestConnectionData> = {
      sessionId: "session-1",
      owner,
      session: durableSession,
      data: { token: "private" },
    };

    await expect(Effect.runPromise(core.connect(connection))).resolves.toBe(true);
    await Effect.runPromise(
      core.handleMessage(
        connection,
        JSON.stringify({
          v: 1,
          requestId: "prompt-1",
          type: "prompt",
          text: "initial",
        }),
      ),
    );
    await waitFor(() => streamCalls === 1);

    await Effect.runPromise(
      core.handleMessage(
        connection,
        JSON.stringify({
          v: 1,
          requestId: "steer-1",
          type: "steer",
          text: "change direction",
        }),
      ),
    );
    expect(frames.some((frame) => frame.includes('"requestId":"steer-1"'))).toBe(true);
    releaseFirst();
    await waitFor(() => frames.some((frame) => frame.includes('"type":"agent_end"')));
    await waitFor(() => streamCalls === 2);

    expect(contexts[1]?.messages.some((message) => message.role === "user")).toBe(true);
    const entries = await Effect.runPromise(
      readSessionLog(host, agentSessionAddress(connection.sessionId)),
    );
    const messages = entries.flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);

    await Effect.runPromise(core.disconnect(connection.sessionId, durableSession.id));
  });

  it("rejects a different owner and evicts idle in-memory agents", async () => {
    const host = makeMemoryDurableEntityHost();
    let now = 1_000;
    const core = new AgentSessionCore<TestConnectionData>({
      host,
      idleTimeoutMs: 50,
      now: () => now,
      factory: {
        create: ({ messages }) =>
          new Agent({ initialState: { model, messages: [...messages], tools: [] } }),
        resolveModel: () => model,
      },
    });
    const session = makeNodeDurableEntitySession("connection-1", {
      send: () => undefined,
      close: () => undefined,
    });
    const connection: AgentSessionConnection<TestConnectionData> = {
      sessionId: "session-2",
      owner,
      session,
      data: { token: "private" },
    };
    await expect(Effect.runPromise(core.connect(connection))).resolves.toBe(true);
    await Effect.runPromise(
      core.handleMessage(
        connection,
        JSON.stringify({ v: 1, requestId: "state-1", type: "get_state" }),
      ),
    );
    expect(core.hasLiveSession(connection.sessionId)).toBe(true);

    const intruder = {
      ...connection,
      session: makeNodeDurableEntitySession("connection-2", {
        send: () => undefined,
        close: () => undefined,
      }),
      owner: { ...owner, userId: "other" },
    };
    await expect(Effect.runPromise(core.connect(intruder))).resolves.toBe(false);

    await Effect.runPromise(core.disconnect(connection.sessionId, session.id));
    now += 51;
    await expect(Effect.runPromise(core.onAlarm(connection.sessionId))).resolves.toBe(true);
    expect(core.hasLiveSession(connection.sessionId)).toBe(false);
  });

  it("rehydrates the latest persisted model selection after idle eviction", async () => {
    const host = makeMemoryDurableEntityHost();
    let now = 1_000;
    const core = new AgentSessionCore<TestConnectionData>({
      host,
      idleTimeoutMs: 50,
      now: () => now,
      factory: {
        create: ({ messages }) =>
          new Agent({ initialState: { model, messages: [...messages], tools: [] } }),
        resolveModel: (provider, modelId) =>
          provider === alternateModel.provider && modelId === alternateModel.id
            ? alternateModel
            : undefined,
      },
    });
    const frames: string[] = [];
    const firstSession = makeNodeDurableEntitySession("connection-model-1", {
      send: () => undefined,
      close: () => undefined,
    });
    const firstConnection: AgentSessionConnection<TestConnectionData> = {
      sessionId: "session-model",
      owner,
      session: firstSession,
      data: { token: "private" },
    };
    await Effect.runPromise(core.connect(firstConnection));
    await Effect.runPromise(
      core.handleMessage(
        firstConnection,
        JSON.stringify({
          v: 1,
          requestId: "model-1",
          type: "set_model",
          provider: alternateModel.provider,
          modelId: alternateModel.id,
        }),
      ),
    );
    await Effect.runPromise(core.disconnect(firstConnection.sessionId, firstSession.id));
    now += 51;
    await Effect.runPromise(core.onAlarm(firstConnection.sessionId));

    const secondSession = makeNodeDurableEntitySession("connection-model-2", {
      send: (frame) => frames.push(String(frame)),
      close: () => undefined,
    });
    const secondConnection = { ...firstConnection, session: secondSession };
    await Effect.runPromise(core.connect(secondConnection));
    await Effect.runPromise(
      core.handleMessage(
        secondConnection,
        JSON.stringify({ v: 1, requestId: "state-model", type: "get_state" }),
      ),
    );
    expect(
      frames.some(
        (frame) =>
          frame.includes('"requestId":"state-model"') && frame.includes('"id":"alternate-model"'),
      ),
    ).toBe(true);
    await Effect.runPromise(core.disconnect(secondConnection.sessionId, secondSession.id));
  });
});
