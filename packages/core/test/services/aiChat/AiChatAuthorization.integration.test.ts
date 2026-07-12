import { type UserSession } from "@voidhash/core/domain/auth/Auth";
import { AiChatForbiddenError, AiChatService } from "@voidhash/core/services";
import { Db, eq, voidhashAiChat } from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { PublicFileStore } from "../../../src/services/storage/PublicFileStore.ts";

const { test } = CoreIntegrationTestHarness.make();
const suffix = crypto.randomUUID();
const chatId = `it_chat_auth_${suffix}`;
const attackerProjectId = `it_project_attacker_${suffix}`;
const objectWrites: string[] = [];

const PublicFileStoreTest = Layer.succeed(PublicFileStore, {
  publicBaseUrl: "https://files.example.test",
  publicUrl: (key: string) => `https://files.example.test/files/${key}`,
  putObject: ({ key }: { readonly key: string }) =>
    Effect.sync(() => {
      objectWrites.push(key);
    }),
  getObject: () => Effect.succeed(null),
  deleteObject: () => Effect.void,
});

const ServiceUnderTest = AiChatService.layer.pipe(Layer.provide(PublicFileStoreTest));

const attackerSession = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:all"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: null,
  projects: [
    {
      id: attackerProjectId,
      logo: null,
      name: "Attacker project",
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: `attacker-${suffix}`,
    },
  ],
  user: {
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const asAttacker = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(attackerSession()));

test(
  "every persisted AI chat operation binds authorization to the stored project",
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* AiChatService;
    objectWrites.length = 0;

    yield* db.insert(voidhashAiChat).values({
      chatType: "persistent",
      id: chatId,
      messages: '[{"role":"user","content":"private"}]',
      organizationId: CoreTestFixture.organizationId,
      paywallId: null,
      projectId: CoreTestFixture.projectId,
      surface: "designer",
      title: "Victim chat",
      userId: CoreTestFixture.userId,
    });

    const expectForbidden = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const error = yield* asAttacker(operation).pipe(Effect.flip);
        expect(error).toBeInstanceOf(AiChatForbiddenError);
      });

    yield* expectForbidden(
      service.save({
        chatType: "persistent",
        id: chatId,
        messages: "[]",
        organizationId: CoreTestFixture.organizationId,
        projectId: attackerProjectId,
        surface: "designer",
        title: "Compromised",
      }),
    );
    yield* expectForbidden(
      service.list({
        organizationId: CoreTestFixture.organizationId,
        projectId: CoreTestFixture.projectId,
        surface: "designer",
      }),
    );
    yield* expectForbidden(service.get({ chatId }));
    yield* expectForbidden(service.delete({ chatId }));
    yield* expectForbidden(
      service.uploadAttachment({
        chatId,
        contentType: "image/png",
        dataBase64: "iVBORw0KGgo=",
        name: "attacker.png",
        organizationId: CoreTestFixture.organizationId,
      }),
    );
    yield* expectForbidden(service.getLastTurnCheckpoints({ chatId }));

    const row = yield* db.query.voidhashAiChat.findFirst({ where: { id: chatId } });
    expect(row).toMatchObject({
      messages: '[{"role":"user","content":"private"}]',
      projectId: CoreTestFixture.projectId,
      title: "Victim chat",
    });
    expect(objectWrites).toEqual([]);
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.delete(voidhashAiChat).where(eq(voidhashAiChat.id, chatId)).pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServiceUnderTest),
    CoreAuthSession.authenticate(),
  ),
);
