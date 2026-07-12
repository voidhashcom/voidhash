import { type UserSession } from "@voidhash/core/domain/auth/Auth";
import { PaywallAssetForbiddenError, PaywallAssetService } from "@voidhash/core/services";
import { Db, eq, paywallAsset } from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { PublicFileStore } from "../../../src/services/storage/PublicFileStore.ts";

const { test } = CoreIntegrationTestHarness.make();
const suffix = crypto.randomUUID();
const assetId = suffix;
const assetKey = `paywall-assets/${CoreTestFixture.organizationId}/${suffix}.png`;
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

const ServiceUnderTest = PaywallAssetService.layer.pipe(Layer.provide(PublicFileStoreTest));

const sessionWithoutOrganizationAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
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

const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutOrganizationAccess()));

test(
  "every paywall asset operation rejects a cross-organization caller before mutation",
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* PaywallAssetService;
    objectMutations.length = 0;

    yield* db.insert(paywallAsset).values({
      contentType: "image/png",
      id: assetId,
      key: assetKey,
      name: "Victim asset",
      organizationId: CoreTestFixture.organizationId,
      sizeBytes: 8,
      url: `https://files.example.test/files/${assetKey}`,
    });

    const expectForbidden = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const error = yield* asUnauthorized(operation).pipe(Effect.flip);
        expect(error).toBeInstanceOf(PaywallAssetForbiddenError);
      });

    yield* expectForbidden(
      service.upload({
        contentType: "image/png",
        imageBase64: "iVBORw0KGgo=",
        name: "attacker.png",
        organizationId: CoreTestFixture.organizationId,
      }),
    );
    yield* expectForbidden(service.list({ organizationId: CoreTestFixture.organizationId }));
    yield* expectForbidden(service.rename({ assetId, name: "Compromised" }));
    yield* expectForbidden(service.delete({ assetId }));

    const row = yield* db.query.paywallAsset.findFirst({ where: { id: assetId } });
    expect(row).toMatchObject({
      name: "Victim asset",
      organizationId: CoreTestFixture.organizationId,
    });
    expect(objectMutations).toEqual([]);
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.delete(paywallAsset).where(eq(paywallAsset.id, assetId)).pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServiceUnderTest),
    CoreAuthSession.authenticate(),
  ),
);
