import { Agent, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context as PiContext,
  type Model,
} from "@earendil-works/pi-ai";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-selfhost/MemoryDurableEntity";
import { makeNodeDurableEntitySession } from "@voidhash/platform-selfhost/NodeDurableEntitySession";
import { Clock, Deferred, Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentSessionCore,
  agentSessionAddress,
  type AgentSessionConnection,
} from "../src/AgentSessionCore.ts";
import { AgentClientMessageSchema } from "../src/Protocol.ts";
import { readSessionLog } from "../src/SessionLog.ts";

const encodeClientMessage = Schema.encodeSync(Schema.fromJsonString(AgentClientMessageSchema));

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
  timestamp: Effect.runSync(Clock.currentTimeMillis),
});

const messageText = (message: AssistantMessage): string => {
  const first = message.content[0];
  if (first?.type === "text") return first.text;
  return "";
};

const replyText = (call: number): string => {
  if (call === 1) return "first";
  return "steered";
};

const resolveTestModel = (candidate: Model<string>, provider: string, modelId: string) => {
  if (provider === candidate.provider && modelId === candidate.id) return candidate;
  return undefined;
};

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (predicate()) return;
      yield* Effect.sleep("5 millis");
    }
    return yield* Effect.die(new Error("Timed out waiting for condition"));
  });

interface TestConnectionData {
  readonly token: string;
}

const owner = { organizationId: "org", projectId: "project", userId: "user" };

describe("AgentSessionCore", () => {
  it("streams, persists, rehydrates, and accepts steering while a turn is active", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const host = makeMemoryDurableEntityHost();
        const frames: string[] = [];
        const firstGate = yield* Deferred.make<void>();
        const contexts: PiContext[] = [];
        let streamCalls = 0;

        const streamFn: StreamFn = (_model, context) => {
          contexts.push(context);
          streamCalls += 1;
          const call = streamCalls;
          const stream = createAssistantMessageEventStream();
          Effect.runFork(
            Effect.gen(function* () {
              if (call === 1) yield* Deferred.await(firstGate);
              const message = assistantMessage(replyText(call));
              stream.push({ type: "start", partial: { ...message, content: [] } });
              stream.push({
                type: "text_start",
                contentIndex: 0,
                partial: { ...message, content: [{ type: "text", text: "" }] },
              });
              stream.push({
                type: "text_delta",
                contentIndex: 0,
                delta: messageText(message),
                partial: message,
              });
              stream.push({
                type: "text_end",
                contentIndex: 0,
                content: messageText(message),
                partial: message,
              });
              stream.push({ type: "done", reason: "stop", message });
            }),
          );
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
            resolveModel: (provider, modelId) => resolveTestModel(model, provider, modelId),
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

        expect(yield* core.connect(connection)).toBe(true);
        yield* core.handleMessage(
          connection,
          encodeClientMessage({
            v: 1,
            requestId: "prompt-1",
            type: "prompt",
            text: "initial",
          }),
        );
        yield* waitFor(() => streamCalls === 1);

        yield* core.handleMessage(
          connection,
          encodeClientMessage({
            v: 1,
            requestId: "steer-1",
            type: "steer",
            text: "change direction",
          }),
        );
        expect(frames.some((frame) => frame.includes('"requestId":"steer-1"'))).toBe(true);
        yield* Deferred.succeed(firstGate, undefined);
        yield* waitFor(() => frames.some((frame) => frame.includes('"type":"agent_end"')));
        yield* waitFor(() => streamCalls === 2);

        expect(contexts[1]?.messages.some((message) => message.role === "user")).toBe(true);
        const entries = yield* readSessionLog(host, agentSessionAddress(connection.sessionId));
        const messages = entries.flatMap((entry) => {
          if (entry.type === "message") return [entry.message];
          return [];
        });
        expect(messages.map((message) => message.role)).toEqual([
          "user",
          "assistant",
          "user",
          "assistant",
        ]);

        yield* core.disconnect(connection.sessionId, durableSession.id);
      }),
    ));

  it("rejects a different owner and evicts idle in-memory agents", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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
        expect(yield* core.connect(connection)).toBe(true);
        yield* core.handleMessage(
          connection,
          encodeClientMessage({ v: 1, requestId: "state-1", type: "get_state" }),
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
        expect(yield* core.connect(intruder)).toBe(false);

        yield* core.disconnect(connection.sessionId, session.id);
        now += 51;
        expect(yield* core.onAlarm(connection.sessionId)).toBe(true);
        expect(core.hasLiveSession(connection.sessionId)).toBe(false);
      }),
    ));

  it("rehydrates the latest persisted model selection after idle eviction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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
              resolveTestModel(alternateModel, provider, modelId),
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
        yield* core.connect(firstConnection);
        yield* core.handleMessage(
          firstConnection,
          encodeClientMessage({
            v: 1,
            requestId: "model-1",
            type: "set_model",
            provider: alternateModel.provider,
            modelId: alternateModel.id,
          }),
        );
        yield* core.disconnect(firstConnection.sessionId, firstSession.id);
        now += 51;
        yield* core.onAlarm(firstConnection.sessionId);

        const secondSession = makeNodeDurableEntitySession("connection-model-2", {
          send: (frame) => frames.push(String(frame)),
          close: () => undefined,
        });
        const secondConnection = { ...firstConnection, session: secondSession };
        yield* core.connect(secondConnection);
        yield* core.handleMessage(
          secondConnection,
          encodeClientMessage({ v: 1, requestId: "state-model", type: "get_state" }),
        );
        expect(
          frames.some(
            (frame) =>
              frame.includes('"requestId":"state-model"') &&
              frame.includes('"id":"alternate-model"'),
          ),
        ).toBe(true);
        yield* core.disconnect(secondConnection.sessionId, secondSession.id);
      }),
    ));
});
