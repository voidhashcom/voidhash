import { createServer, type Server } from "node:http";

import {
  AgentSessionIndexService,
  IdentityProvider,
  LocalUserSessionService,
  PaywallService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { Db } from "@voidhash/db";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-selfhost/MemoryDurableEntity";
import { Context, Effect, Redacted } from "effect";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { installAgentNodeWebSocketServer } from "../src/agent/AgentNodeWebSocket.ts";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

const listen = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("HTTP server did not expose a TCP port"));
        return;
      }
      servers.push(server);
      resolve(address.port);
    });
  });

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for the Node agent WebSocket");
};

const authSession = {
  cookie: null,
  method: "user" as const,
  name: "Probe user",
  person: null,
  organizations: [
    {
      id: "org_1",
      logo: null,
      name: "Organization",
      permissions: ["organization:all"],
      slug: "organization",
      workosOrganizationId: "workos_org_1",
    },
  ],
  projects: [
    {
      id: "project_1",
      logo: null,
      name: "Project",
      organizationId: "org_1",
      permissions: ["project:all"],
      slug: "project",
    },
  ],
  user: {
    id: "user_1",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    email: "user@example.com",
    emailVerified: true,
    image: null,
    name: "Probe user",
    role: null,
    workosUserId: "workos_user_1",
  },
};

const identity = {
  email: "user@example.com",
  emailVerified: true,
  externalId: "user_1",
  firstName: "Probe",
  id: "workos_user_1",
  lastName: "user",
  profilePictureUrl: null,
};

const makeServices = () => {
  let context = Context.empty() as Context.Context<never>;
  context = Context.add(context, Db, {} as never);
  context = Context.add(context, LocalUserSessionService, {
    resolveLocalUser: () => Effect.succeed(authSession.user),
    loadUserAccess: () =>
      Effect.succeed({
        organizations: authSession.organizations,
        projects: authSession.projects,
      }),
    toUserSession: () => authSession,
  } as unknown as LocalUserSessionService["Service"]);
  context = Context.add(context, IdentityProvider, {
    cookieName: "voidhash-session",
    authenticateSessionCookie: () => Effect.succeed(null),
    resolveIdentity: () => Effect.succeed(identity),
    resolveIdentityById: () => Effect.succeed(identity),
    linkExternalId: () => Effect.void,
  } as IdentityProvider["Service"]);
  context = Context.add(context, AgentSessionIndexService, {
    touch: () => Effect.succeed(undefined),
  } as unknown as AgentSessionIndexService["Service"]);
  context = Context.add(context, PaywallService, {
    getPaywalls: () => Effect.succeed([]),
  } as unknown as PaywallService["Service"]);
  context = Context.add(context, PaywallWorkspaceService, {} as PaywallWorkspaceService["Service"]);
  return context as Context.Context<any>;
};

describe("installAgentNodeWebSocketServer", () => {
  it("authenticates, streams, and accepts steering through a real Node WebSocket", async () => {
    let releaseFirstProvider!: () => void;
    const firstProviderGate = new Promise<void>((resolve) => {
      releaseFirstProvider = resolve;
    });
    let providerRequests = 0;
    const provider = createServer((request, response) => {
      if (request.url !== "/v1/responses") {
        response.writeHead(404).end();
        return;
      }
      providerRequests += 1;
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      response.write(
        `data: ${JSON.stringify({
          type: "response.created",
          response: { id: `response_${providerRequests}`, status: "in_progress", output: [] },
        })}\n\n`,
      );
      const finishResponse = () => {
        const events = [
          {
            type: "response.output_item.added",
            output_index: 0,
            item: {
              id: "message_1",
              type: "message",
              role: "assistant",
              status: "in_progress",
              content: [],
            },
          },
          { type: "response.output_text.delta", output_index: 0, delta: "node-host-ok" },
          {
            type: "response.output_item.done",
            output_index: 0,
            item: {
              id: "message_1",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "node-host-ok", annotations: [] }],
            },
          },
          {
            type: "response.completed",
            response: {
              id: "response_1",
              status: "completed",
              output: [],
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
          },
        ];
        for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
        response.end("data: [DONE]\n\n");
      };
      if (providerRequests === 1) {
        void firstProviderGate.then(finishResponse);
      } else {
        finishResponse();
      }
    });
    const providerPort = await listen(provider);

    const server = createServer((_request, response) => response.writeHead(404).end());
    const host = installAgentNodeWebSocketServer(
      server,
      makeMemoryDurableEntityHost(),
      makeServices(),
      {
        validateToken: () =>
          Effect.succeed({
            payload: { sub: "workos_user_1", email: "user@example.com" },
            provider: "workos" as const,
          }),
      },
      {
        provider: "openai",
        modelId: "gpt-5.4",
        visionProvider: "openai",
        visionModelId: "gpt-5.4",
        openaiApiKey: Redacted.make("probe-key"),
        openaiBaseUrl: `http://127.0.0.1:${providerPort}/v1`,
      },
    );
    const port = await listen(server);
    const frames: Array<Record<string, any>> = [];
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/agent/sessions/agent_1/ws?organizationId=org_1&projectId=project_1&surface=designer`,
      { headers: { authorization: "Bearer probe-token" } },
    );
    socket.on("message", (data) => frames.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    socket.send(JSON.stringify({ v: 1, type: "prompt", requestId: "prompt_1", text: "hello" }));
    await waitFor(
      () =>
        providerRequests === 1 &&
        frames.some((frame) => frame.type === "event" && frame.event?.type === "agent_start"),
    );
    socket.send(JSON.stringify({ v: 1, type: "get_state", requestId: "streaming_state" }));
    await waitFor(() =>
      frames.some(
        (frame) =>
          frame.type === "state" &&
          frame.requestId === "streaming_state" &&
          frame.state?.isStreaming === true,
      ),
    );
    socket.send(
      JSON.stringify({ v: 1, type: "steer", requestId: "steer_1", text: "change direction" }),
    );
    await waitFor(() =>
      frames.some(
        (frame) =>
          frame.type === "ack" && frame.requestId === "steer_1" && frame.command === "steer",
      ),
    );
    releaseFirstProvider();
    await waitFor(() =>
      frames.some((frame) => frame.type === "event" && frame.event?.type === "agent_end"),
    );

    const text = frames
      .filter((frame) => frame.type === "event" && frame.event?.type === "message_end")
      .flatMap((frame) => frame.event.message?.content ?? [])
      .find((content) => content.type === "text")?.text;
    expect(text).toBe("node-host-ok");
    expect(providerRequests).toBeGreaterThanOrEqual(2);

    socket.send(JSON.stringify({ v: 1, type: "get_entries", requestId: "entries_1" }));
    await waitFor(() =>
      frames.some((frame) => frame.type === "entries" && frame.requestId === "entries_1"),
    );
    const entries = frames.find(
      (frame) => frame.type === "entries" && frame.requestId === "entries_1",
    )?.entries;
    const userText = Array.isArray(entries)
      ? entries
          .filter((entry) => entry.type === "message" && entry.message?.role === "user")
          .flatMap((entry) => {
            const content = entry.message.content;
            if (typeof content === "string") return [content];
            if (!Array.isArray(content)) return [];
            return content.filter((part) => part.type === "text").map((part) => part.text);
          })
      : [];
    expect(userText).toContain("change direction");

    socket.close();
    host.close();
  });
});
