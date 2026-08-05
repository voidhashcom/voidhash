import { Agent, type AgentMessage, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import {
  DurableEntityAlarmControl,
  DurableEntityHost,
} from "@voidhash/platform/DurableEntity";
import { PgClusterDurableEntityLive } from "@voidhash/platform-selfhost/ClusterDurableEntity";
import { makeNodeDurableEntitySession } from "@voidhash/platform-selfhost/NodeDurableEntitySession";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Effect, ManagedRuntime, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentSessionCore,
  agentSessionAddress,
  type AgentSessionConnection,
} from "../src/AgentSessionCore.ts";
import { readSessionLogCount } from "../src/SessionLog.ts";

const config: PgPlatformConfig = {
  host: process.env.PLATFORM_SELFHOST_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_SELFHOST_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_SELFHOST_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_SELFHOST_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_SELFHOST_PG_PASSWORD ?? "password"),
};

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
  });
  return stream;
};

const waitFor = async (predicate: () => Promise<boolean> | boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the cluster agent session");
};

describe("AgentSessionCore on the cluster durable entity host", () => {
  it("persists a turn and rehydrates it after the host runtime restarts", async () => {
    const sessionId = `agent-cluster-${crypto.randomUUID()}`;
    const owner = {
      organizationId: "organization-cluster",
      projectId: "project-cluster",
      userId: "user-cluster",
    };
    const firstRuntime = ManagedRuntime.make(PgClusterDurableEntityLive(config));
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
            requestId: "prompt-cluster",
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
      // Disconnecting the last socket arms the idle alarm, which only ever
      // fires if the control plane can enumerate it out of storage.
      await Effect.runPromise(firstCore.disconnect(sessionId, "connection-1"));
      const firstControl = await firstRuntime.runPromise(DurableEntityAlarmControl);
      const due = await Effect.runPromise(
        firstControl.listDueAlarms(Date.now() + 10 * 60_000, 200),
      );
      expect(due.some((alarm) => alarm.address.id === sessionId)).toBe(true);
    } finally {
      await firstRuntime.dispose();
    }

    const secondRuntime = ManagedRuntime.make(PgClusterDurableEntityLive(config));
    const secondHost = await secondRuntime.runPromise(DurableEntityHost);
    // Persisted state crosses the restart; the sockets that were attached to
    // the previous process do not.
    const carriedSessions = await Effect.runPromise(
      secondHost.run(agentSessionAddress(sessionId), (entity) => entity.sessions.list),
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

    try {
      await expect(Effect.runPromise(secondCore.connect(secondConnection))).resolves.toBe(true);
      await Effect.runPromise(
        secondCore.handleMessage(
          secondConnection,
          JSON.stringify({ v: 1, type: "get_state", requestId: "state-cluster" }),
        ),
      );
      expect(restoredMessages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(frames.some((frame) => frame.includes("cluster-host-ok"))).toBe(true);
      // Connecting cleared the idle alarm the previous process armed.
      const secondControl = await secondRuntime.runPromise(DurableEntityAlarmControl);
      const due = await Effect.runPromise(
        secondControl.listDueAlarms(Date.now() + 10 * 60_000, 200),
      );
      expect(due.some((alarm) => alarm.address.id === sessionId)).toBe(false);
    } finally {
      await secondRuntime.dispose();
    }
  });
});
