import { Agent, type AgentMessage, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import { NodeCrypto } from "@effect/platform-node";
import { DurableEntityAlarmControl, DurableEntityHost } from "@voidhash/platform/DurableEntity";
import { PgClusterDurableEntityLive } from "@voidhash/platform-node/ClusterDurableEntity";
import { makeNodeDurableEntitySession } from "@voidhash/platform-node/NodeDurableEntitySession";
import type { PgPlatformConfig } from "@voidhash/platform-node/Postgres";
import { Clock, Config, Crypto, Effect, ManagedRuntime, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentSessionCore,
  agentSessionAddress,
  type AgentSessionConnection,
} from "../src/AgentSessionCore.ts";
import { AgentClientMessageSchema } from "../src/Protocol.ts";
import { readSessionLogCount } from "../src/SessionLog.ts";

const encodeClientMessage = Schema.encodeSync(Schema.fromJsonString(AgentClientMessageSchema));

const loadConfig: Effect.Effect<PgPlatformConfig> = Effect.gen(function* () {
  return {
    host: yield* Config.string("PLATFORM_NODE_PG_HOST").pipe(Config.withDefault("127.0.0.1")),
    port: yield* Config.int("PLATFORM_NODE_PG_PORT").pipe(Config.withDefault(5432)),
    database: yield* Config.string("PLATFORM_NODE_PG_DATABASE").pipe(
      Config.withDefault("voidhash"),
    ),
    username: yield* Config.string("PLATFORM_NODE_PG_USERNAME").pipe(
      Config.withDefault("voidhash"),
    ),
    password: yield* Config.redacted("PLATFORM_NODE_PG_PASSWORD").pipe(
      Config.withDefault(Redacted.make("password")),
    ),
  };
}).pipe(Effect.orDie);

const model: Model<string> = {
  id: "cluster-test-model",
  name: "Cluster test model",
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
  content: [{ type: "text", text: "cluster-host-ok" }],
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
  timestamp: Effect.runSync(Clock.currentTimeMillis),
});

const streamFn: StreamFn = () => {
  const stream = createAssistantMessageEventStream();
  const message = assistantMessage();
  Effect.runFork(
    Effect.gen(function* () {
      yield* Effect.yieldNow;
      stream.push({ type: "start", partial: { ...message, content: [] } });
      stream.push({
        type: "text_start",
        contentIndex: 0,
        partial: { ...message, content: [{ type: "text", text: "" }] },
      });
      stream.push({
        type: "text_delta",
        contentIndex: 0,
        delta: "cluster-host-ok",
        partial: message,
      });
      stream.push({
        type: "text_end",
        contentIndex: 0,
        content: "cluster-host-ok",
        partial: message,
      });
      stream.push({ type: "done", reason: "stop", message });
    }),
  );
  return stream;
};

const waitFor = <E, R>(predicate: Effect.Effect<boolean, E, R>): Effect.Effect<void, E, R> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (yield* predicate) return;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error("Timed out waiting for the cluster agent session"));
  });

describe("AgentSessionCore on the cluster durable entity host", () => {
  it("persists a turn and rehydrates it after the host runtime restarts", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* loadConfig;
        const crypto = yield* Crypto.Crypto;
        const sessionId = `agent-cluster-${yield* crypto.randomUUIDv4}`;
        const owner = {
          organizationId: "organization-cluster",
          projectId: "project-cluster",
          userId: "user-cluster",
        };
        const firstRuntime = ManagedRuntime.make(PgClusterDurableEntityLive(config));
        const firstHost = yield* Effect.promise(() => firstRuntime.runPromise(DurableEntityHost));
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

        yield* Effect.gen(function* () {
          expect(yield* firstCore.connect(firstConnection)).toBe(true);
          yield* firstCore.handleMessage(
            firstConnection,
            encodeClientMessage({
              v: 1,
              type: "prompt",
              requestId: "prompt-cluster",
              text: "persist this turn",
            }),
          );
          yield* waitFor(
            Effect.map(
              readSessionLogCount(firstHost, agentSessionAddress(sessionId)),
              (count) => count === 2,
            ),
          );
          // Disconnecting the last socket arms the idle alarm, which only ever
          // fires if the control plane can enumerate it out of storage.
          yield* firstCore.disconnect(sessionId, "connection-1");
          const firstControl = yield* Effect.promise(() =>
            firstRuntime.runPromise(DurableEntityAlarmControl),
          );
          const firstDeadline = yield* Clock.currentTimeMillis;
          const due = yield* firstControl.listDueAlarms(firstDeadline + 10 * 60_000, 200);
          expect(due.some((alarm) => alarm.address.id === sessionId)).toBe(true);
        }).pipe(Effect.ensuring(firstRuntime.disposeEffect));

        const secondRuntime = ManagedRuntime.make(PgClusterDurableEntityLive(config));
        const secondHost = yield* Effect.promise(() => secondRuntime.runPromise(DurableEntityHost));
        // Persisted state crosses the restart; the sockets that were attached to
        // the previous process do not.
        const carriedSessions = yield* secondHost.run(
          agentSessionAddress(sessionId),
          (entity) => entity.sessions.list,
        );
        expect(carriedSessions).toEqual([]);
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

        yield* Effect.gen(function* () {
          expect(yield* secondCore.connect(secondConnection)).toBe(true);
          yield* secondCore.handleMessage(
            secondConnection,
            encodeClientMessage({ v: 1, type: "get_state", requestId: "state-cluster" }),
          );
          expect(restoredMessages.map((message) => message.role)).toEqual(["user", "assistant"]);
          expect(frames.some((frame) => frame.includes("cluster-host-ok"))).toBe(true);
          // Connecting cleared the idle alarm the previous process armed.
          const secondControl = yield* Effect.promise(() =>
            secondRuntime.runPromise(DurableEntityAlarmControl),
          );
          const secondDeadline = yield* Clock.currentTimeMillis;
          const due = yield* secondControl.listDueAlarms(secondDeadline + 10 * 60_000, 200);
          expect(due.some((alarm) => alarm.address.id === sessionId)).toBe(false);
        }).pipe(Effect.ensuring(secondRuntime.disposeEffect));
      }).pipe(Effect.provide(NodeCrypto.layer)),
    ));
});
