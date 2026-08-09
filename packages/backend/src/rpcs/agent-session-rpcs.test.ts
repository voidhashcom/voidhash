import {
  AgentAttachmentService,
  AgentSessionIndexService,
  PaywallEditSessionService,
  type AgentSessionIndexServiceShape,
} from "@voidhash/core/services";
import {
  AgentSessionRpcsDef,
  AuthMiddleware,
  AuthSession,
  type AnyAuthSession,
} from "@voidhash/rpc";
import { DateTime, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { AgentSessionRpcsLive } from "./agent-session-rpcs.ts";

const epochDate = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

const summary = {
  id: "agent_1",
  organizationId: "org_1",
  projectId: "project_1",
  surface: "designer",
  paywallId: "paywall_1",
  userId: "user_1",
  title: "Improve onboarding",
  createdAt: epochDate(0),
  updatedAt: epochDate(1),
};

const reverted: Array<{ editSessionId: string; sessionId: string }> = [];

/** Methods these RPCs never reach are defects, not silently-wrong stubs. */
const unused = () => Effect.die("stub method is not used by this test");

const sessionIndexStub: AgentSessionIndexServiceShape = {
  touch: unused,
  list: () => Effect.succeed([summary]),
  get: () => Effect.succeed(summary),
  delete: () => Effect.void,
};

const attachmentStub: AgentAttachmentService["Service"] = {
  upload: ({ name, contentType }) =>
    Effect.succeed({
      url: "https://files.example.com/reference.png",
      name,
      contentType,
      sizeBytes: 10,
    }),
};

const editSessionStub: PaywallEditSessionService["Service"] = {
  begin: unused,
  connectActive: unused,
  recordMutation: unused,
  requireActive: unused,
  recordPreview: unused,
  finish: unused,
  revert: unused,
  revertForAgentSession: (_projectId, editSessionId, sessionId) =>
    Effect.sync(() => {
      reverted.push({ editSessionId, sessionId });
      return { version: 2, commandCount: 1, paywallSlug: "trial" };
    }),
};

const testAuthSession: AnyAuthSession = {
  cookie: null,
  method: "user",
  name: "Test User <test@example.test>",
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: epochDate(0),
    email: "test@example.test",
    emailVerified: true,
    id: "user_1",
    image: null,
    name: "Test User",
    role: null,
    updatedAt: epochDate(0),
    workosUserId: null,
  },
};

const handlers = Layer.mergeAll(
  AgentSessionRpcsLive.pipe(
    Layer.provide(Layer.succeed(AgentSessionIndexService, sessionIndexStub)),
    Layer.provide(Layer.succeed(AgentAttachmentService, attachmentStub)),
    Layer.provide(Layer.succeed(PaywallEditSessionService, editSessionStub)),
  ),
  Layer.succeed(
    AuthMiddleware,
    AuthMiddleware.of((effect) => Effect.provideService(effect, AuthSession, testAuthSession)),
  ),
);

describe("AgentSessionRpcs", () => {
  it("lists indexed durable sessions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(AgentSessionRpcsDef);
        return yield* client.ListAgentSessions({
          organizationId: "org_1",
          projectId: "project_1",
          surface: "designer",
        });
      }).pipe(Effect.provide(handlers), Effect.scoped),
    ).then((sessions) => {
      expect(sessions).toEqual([summary]);
    }));

  it("uploads a prompt attachment", () =>
    Effect.runPromise(
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
    ).then((attachment) => {
      expect(attachment).toMatchObject({
        name: "reference.png",
        contentType: "image/png",
      });
    }));

  it("reverts an edit session through its owning agent-session scope", () => {
    reverted.length = 0;
    return Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(AgentSessionRpcsDef);
        yield* client.RevertAgentEditSession({
          sessionId: "agent_1",
          editSessionId: "change_1",
        });
      }).pipe(Effect.provide(handlers), Effect.scoped),
    ).then(() => {
      expect(reverted).toEqual([{ editSessionId: "change_1", sessionId: "agent_1" }]);
    });
  });
});
