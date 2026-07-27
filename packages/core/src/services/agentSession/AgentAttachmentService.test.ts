import { Effect, Layer } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { describe, expect, it } from "../../testing/effect-vitest.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { AgentSessionIndexService, AgentSessionNotFoundError } from "./AgentSessionIndexService.ts";
import { AgentAttachmentForbiddenError, AgentAttachmentService } from "./AgentAttachmentService.ts";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const auth = {
  cookie: null,
  method: "user" as const,
  name: "User",
  person: null,
  organizations: [
    {
      id: "org_1",
      logo: null,
      name: "Org",
      permissions: ["organization:all"],
      slug: "org",
      workosOrganizationId: "workos_org_1",
    },
  ],
  projects: [],
  user: {
    id: "user_1",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    email: "user@example.com",
    emailVerified: true,
    image: null,
    name: "User",
    role: null,
    workosUserId: "workos_user_1",
  },
};

const makeLayer = (indexedOrganization?: string) => {
  const writes: Array<{ key: string; body: Uint8Array; contentType?: string }> = [];
  const index = Layer.succeed(AgentSessionIndexService, {
    get: ({ sessionId }: { sessionId: string }) =>
      indexedOrganization === undefined
        ? Effect.fail(new AgentSessionNotFoundError({ sessionId }))
        : Effect.succeed({
            id: sessionId,
            organizationId: indexedOrganization,
            projectId: "project_1",
            surface: "designer",
            paywallId: null,
            userId: "user_1",
            title: "Session",
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
  } as unknown as AgentSessionIndexService["Service"]);
  const files = Layer.succeed(PublicFileStore, {
    publicBaseUrl: "https://files.example.com",
    publicUrl: (key: string) => `https://files.example.com/files/${key}`,
    putObject: (input: { key: string; body: Uint8Array; contentType?: string }) =>
      Effect.sync(() => void writes.push(input)),
    getObject: () => Effect.succeed(null),
    deleteObject: () => Effect.void,
  });
  return {
    writes,
    layer: AgentAttachmentService.layer.pipe(Layer.provide(index), Layer.provide(files)),
  };
};

describe("AgentAttachmentService", () => {
  it.effect("stores a validated pre-session image under the durable session", () => {
    const fixture = makeLayer();
    return Effect.gen(function* () {
      const service = yield* AgentAttachmentService;
      const attachment = yield* service.upload({
        sessionId: "agent_1",
        organizationId: "org_1",
        name: "reference.png",
        contentType: "image/png",
        dataBase64: png,
      });
      expect(attachment.url).toContain("agent-sessions/agent_1/attachments/agent_att_");
      expect(fixture.writes).toHaveLength(1);
      expect(fixture.writes[0]?.body.length).toBeGreaterThan(0);
    }).pipe(Effect.provideService(AuthSession, auth), Effect.provide(fixture.layer));
  });

  it.effect("rejects a session indexed to another organization", () => {
    const fixture = makeLayer("org_other");
    return Effect.gen(function* () {
      const service = yield* AgentAttachmentService;
      const result = yield* Effect.result(
        service.upload({
          sessionId: "agent_1",
          organizationId: "org_1",
          name: "reference.png",
          contentType: "image/png",
          dataBase64: png,
        }),
      );
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure).toBeInstanceOf(AgentAttachmentForbiddenError);
      }
      expect(fixture.writes).toHaveLength(0);
    }).pipe(Effect.provideService(AuthSession, auth), Effect.provide(fixture.layer));
  });
});
