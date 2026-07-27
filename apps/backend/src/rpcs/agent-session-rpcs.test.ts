import {
  AgentAttachmentService,
  AgentSessionIndexService,
  PaywallEditSessionService,
} from "@voidhash/core/services";
import { AgentSessionRpcsDef, AuthMiddleware, AuthSession } from "@voidhash/rpc";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { AgentSessionRpcsLive } from "./agent-session-rpcs.ts";

const summary = {
  id: "agent_1",
  organizationId: "org_1",
  projectId: "project_1",
  surface: "designer",
  paywallId: "paywall_1",
  userId: "user_1",
  title: "Improve onboarding",
  createdAt: new Date(0),
  updatedAt: new Date(1),
};

const reverted: Array<{ editSessionId: string; sessionId: string }> = [];
const handlers = Layer.mergeAll(
  AgentSessionRpcsLive.pipe(
    Layer.provide(
      Layer.succeed(AgentSessionIndexService, {
        list: () => Effect.succeed([summary]),
        get: () => Effect.succeed(summary),
        delete: () => Effect.void,
      } as unknown as AgentSessionIndexService["Service"]),
    ),
    Layer.provide(
      Layer.succeed(AgentAttachmentService, {
        upload: ({ name, contentType }: { name: string; contentType: string }) =>
          Effect.succeed({
            url: "https://files.example.com/reference.png",
            name,
            contentType,
            sizeBytes: 10,
          }),
      } as AgentAttachmentService["Service"]),
    ),
    Layer.provide(
      Layer.succeed(PaywallEditSessionService, {
        revertForAgentSession: (_projectId: string, editSessionId: string, sessionId: string) =>
          Effect.sync(() => {
            reverted.push({ editSessionId, sessionId });
            return { version: 2, commandCount: 1, paywallSlug: "trial" };
          }),
      } as unknown as PaywallEditSessionService["Service"]),
    ),
  ),
  Layer.succeed(
    AuthMiddleware,
    AuthMiddleware.of((effect) =>
      Effect.provideService(effect, AuthSession, { method: "user" } as never),
    ),
  ),
);

describe("AgentSessionRpcs", () => {
  it("lists indexed durable sessions", async () => {
    const sessions = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(AgentSessionRpcsDef);
        return yield* client.ListAgentSessions({
          organizationId: "org_1",
          projectId: "project_1",
          surface: "designer",
        });
      }).pipe(Effect.provide(handlers), Effect.scoped),
    );
    expect(sessions).toEqual([summary]);
  });

  it("uploads a prompt attachment", async () => {
    const attachment = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(AgentSessionRpcsDef);
        return yield* client.UploadAgentAttachment({
          sessionId: "agent_1",
          organizationId: "org_1",
          name: "reference.png",
          contentType: "image/png",
          dataBase64: "data:image/png;base64,AA==",
        });
      }).pipe(Effect.provide(handlers), Effect.scoped),
    );
    expect(attachment).toMatchObject({
      name: "reference.png",
      contentType: "image/png",
    });
  });

  it("reverts an edit session through its owning agent-session scope", async () => {
    reverted.length = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(AgentSessionRpcsDef);
        yield* client.RevertAgentEditSession({
          sessionId: "agent_1",
          editSessionId: "change_1",
        });
      }).pipe(Effect.provide(handlers), Effect.scoped),
    );
    expect(reverted).toEqual([{ editSessionId: "change_1", sessionId: "agent_1" }]);
  });
});
