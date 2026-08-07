import { type UserSession } from "@voidhash/core/domain/auth/Auth";
import { PublicFileStore, UserService } from "@voidhash/core/services";
import { Db, eq, user } from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { generateId } from "@voidhash/core/utils/generate-id";
import { DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

const { test } = CoreIntegrationTestHarness.make();
const actorId = generateId("user");
const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));
const actorEmail = `avatar-${actorId}@voidhash.test`;
const objectMutations: string[] = [];

const PublicFileStoreTest = Layer.succeed(PublicFileStore, {
  publicBaseUrl: "https://files.example.test",
  publicUrl: (key: string) => `https://files.example.test/files/${key}`,
  putObject: ({ key }: { readonly key: string }) =>
    Effect.sync(() => {
      objectMutations.push(`put:${key}`);
    }),
  getObject: () => Effect.succeed(null),
  deleteObject: (key: string) =>
    Effect.sync(() => {
      objectMutations.push(`delete:${key}`);
    }),
});

const ServiceUnderTest = Layer.merge(UserService.layer, PublicFileStoreTest);

const actorSession = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `Avatar Actor <${actorEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: epoch,
    email: actorEmail,
    emailVerified: true,
    id: actorId,
    image: null,
    name: "Avatar Actor",
    role: null,
    updatedAt: epoch,
    workosUserId: null,
  },
});

test(
  "avatar mutations can only target the authenticated user row",
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* UserService;
    objectMutations.length = 0;

    yield* db.insert(user).values({
      email: actorEmail,
      emailVerified: true,
      id: actorId,
      name: "Avatar Actor",
    });

    const victimBefore = yield* db.query.user.findFirst({
      where: { id: CoreTestFixture.userId },
    });
    const result = yield* service.setAvatar({
      contentType: "image/png",
      imageBase64: "iVBORw0KGgo=",
    });

    const actorAfterSet = yield* db.query.user.findFirst({ where: { id: actorId } });
    const victimAfterSet = yield* db.query.user.findFirst({
      where: { id: CoreTestFixture.userId },
    });
    expect(actorAfterSet?.customImageUrl).toBe(result.imageUrl);
    expect(victimAfterSet?.customImageUrl).toBe(victimBefore?.customImageUrl);
    expect(result.imageUrl).toContain(`/avatars/user/${actorId}/`);

    yield* service.removeAvatar();
    const actorAfterRemove = yield* db.query.user.findFirst({ where: { id: actorId } });
    const victimAfterRemove = yield* db.query.user.findFirst({
      where: { id: CoreTestFixture.userId },
    });
    expect(actorAfterRemove?.customImageUrl).toBeNull();
    expect(victimAfterRemove?.customImageUrl).toBe(victimBefore?.customImageUrl);
    expect(objectMutations.some((mutation) => mutation.startsWith("put:avatars/user/"))).toBe(true);
    expect(objectMutations.some((mutation) => mutation.startsWith("delete:avatars/user/"))).toBe(
      true,
    );
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.delete(user).where(eq(user.id, actorId)).pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServiceUnderTest),
    CoreAuthSession.authenticate(actorSession()),
  ),
);
