import {
  AuditLogPort,
  MimicHost,
  PaywallArtifactStore,
  PaywallReleaseService,
  SnapshotHtmlRenderer,
} from "@voidhash/core/services";
import type { AnyAuthSession } from "@voidhash/core/domain/auth/Auth";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { Db, ReleaseStatus, eq, paywallReleases, paywalls } from "@voidhash/db";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { getSelfhostRuntimeConfig } from "../src/config.ts";

const describePg = process.env.SELFHOST_PG_TEST === "1" ? describe : describe.skip;

const makeSession = (projectId: string, userId: string): AnyAuthSession => {
  const now = new Date();
  return {
    cookie: null,
    method: "user",
    name: "selfhost-release-test",
    organizations: [],
    person: null,
    projects: [
      {
        id: projectId,
        logo: null,
        name: "Self-host release project",
        organizationId: "organization_selfhost_release",
        permissions: ["project:all"],
        slug: "selfhost-release",
      },
    ],
    user: {
      createdAt: now,
      email: "release-test@example.test",
      emailVerified: true,
      id: userId,
      image: null,
      name: "Release Test",
      role: null,
      updatedAt: now,
      workosUserId: null,
    },
  };
};

describePg("self-host paywall releases", () => {
  it("creates, publishes, and advances a visual paywall release", async () => {
    const config = getSelfhostRuntimeConfig();
    const suffix = crypto.randomUUID();
    const paywallId = `paywall_${suffix}`;
    const projectId = `project_${suffix}`;
    const userId = `user_${suffix}`;
    const objects = new Map<string, Uint8Array>();
    const database = Db.layer(config.database);
    const dependencies = Layer.mergeAll(
      database,
      AuditLogPort.noop,
      Layer.succeed(MimicHost, {
        closePaywallConnection: () => Effect.die("unused"),
        createPaywallEditToken: () => Effect.die("unused"),
        ensurePaywallDocument: () => Effect.void,
        getConnectedPaywallDocument: () => Effect.die("unused"),
        getPaywallDocument: () => Effect.die("unused"),
        getPaywallSnapshot: () => Effect.succeed({ id: "root", type: "root" }),
        heartbeatPaywallConnection: () => Effect.die("unused"),
        openPaywallConnection: () => Effect.die("unused"),
        submitConnectedPaywallTransaction: () => Effect.die("unused"),
        submitPaywallTransaction: () => Effect.die("unused"),
      }),
      Layer.succeed(PaywallArtifactStore, {
        bucketName: "selfhost-release-test",
        getObject: (key) =>
          Effect.sync(() => {
            const body = objects.get(key);
            return body === undefined ? null : { body, contentType: "text/html; charset=utf-8" };
          }),
        head: (key) =>
          Effect.succeed(objects.has(key) ? { size: objects.get(key)?.length ?? 0 } : null),
        putObject: ({ body, key }) =>
          Effect.sync(() => {
            objects.set(key, body);
          }),
      }),
      Layer.succeed(PaywallAssetConfig, {
        cdnUrl: "http://localhost:5001",
        publicBaseUrl: "http://localhost:5001",
      }),
      Layer.succeed(SnapshotHtmlRenderer, {
        render: ({ metadata }) =>
          Effect.succeed(`<html><body>release ${metadata.version}</body></html>`),
      }),
    );
    const releaseLayer = PaywallReleaseService.layer.pipe(Layer.provide(dependencies));

    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.insert(paywalls).values({
            id: paywallId,
            name: "Self-host release",
            projectId,
            slug: `selfhost-release-${suffix}`,
          });
        }).pipe(Effect.provide(database)),
      );

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const releases = yield* PaywallReleaseService;
          const firstDraft = yield* releases.createRelease(paywallId);
          const draft = yield* releases.getDraftRelease(paywallId);
          const firstPublished = yield* releases.publishRelease(firstDraft.releaseId);
          const secondDraft = yield* releases.createRelease(paywallId);
          const secondPublished = yield* releases.publishRelease(secondDraft.releaseId);
          return { draft, firstDraft, firstPublished, secondDraft, secondPublished };
        }).pipe(
          Effect.provide(releaseLayer),
          Effect.provideService(AuthSession, makeSession(projectId, userId)),
        ),
      );

      const rows = await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          return yield* db.query.paywallReleases.findMany({
            orderBy: { version: "asc" },
            where: { paywallId },
          });
        }).pipe(Effect.provide(database)),
      );

      expect(result.draft?.releaseId).toBe(result.firstDraft.releaseId);
      expect(result.firstPublished.version).toBe(1);
      expect(result.secondDraft.version).toBe(2);
      expect(result.secondPublished.version).toBe(2);
      expect(objects.size).toBe(2);
      expect(rows.filter((row) => row.status === ReleaseStatus.released)).toHaveLength(2);
      expect(
        rows.find((row) => row.version === 1 && row.status === ReleaseStatus.released)?.isActive,
      ).toBe(false);
      expect(
        rows.find((row) => row.version === 2 && row.status === ReleaseStatus.released)?.isActive,
      ).toBe(true);
    } finally {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.delete(paywallReleases).where(eq(paywallReleases.paywallId, paywallId));
          yield* db.delete(paywalls).where(eq(paywalls.id, paywallId));
        }).pipe(Effect.provide(database)),
      );
    }
  });
});
