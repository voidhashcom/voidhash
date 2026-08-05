import { NodeRuntime } from "@effect/platform-node";
import { BackendSnapshotHtmlRendererLive } from "@voidhash/backend/PaywallSnapshotHtmlRenderer";
import type { AnyAuthSession } from "@voidhash/core/domain/auth/Auth";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import {
  AuditLogPort,
  PaywallReleaseService,
} from "@voidhash/core/services";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { Context, Effect, Layer } from "effect";

import {
  makeBackendInfrastructureLive,
  makeSelfhostAuthLayers,
} from "./backend/Backend.ts";
import { makeSelfhostPlatformLayers } from "./backend/PlatformProfile.ts";
import { getSelfhostRuntimeConfig } from "./config.ts";
import { makeMimicNodeHostLive } from "./mimic/MimicNode.ts";
import { getMimicNodeConfig } from "./mimic/config.ts";

const resultPrefix = "SELFHOST_RELEASE_RESULT ";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const makeSession = (projectId: string, userId: string): AnyAuthSession => {
  const now = new Date();
  return {
    cookie: null,
    method: "user",
    name: "selfhost-release-smoke",
    organizations: [],
    person: null,
    projects: [
      {
        id: projectId,
        logo: null,
        name: "Self-host release smoke",
        organizationId: `organization_${projectId}`,
        permissions: ["project:all"],
        slug: "selfhost-release-smoke",
      },
    ],
    user: {
      createdAt: now,
      email: "release-smoke@voidhash.local",
      emailVerified: true,
      id: userId,
      image: null,
      name: "Self-host Release Smoke",
      role: null,
      updatedAt: now,
      workosUserId: null,
    },
  };
};

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const paywallId = requiredEnv("SELFHOST_RELEASE_PAYWALL_ID");
      const projectId = requiredEnv("SELFHOST_RELEASE_PROJECT_ID");
      const userId = requiredEnv("SELFHOST_RELEASE_USER_ID");
      const config = getSelfhostRuntimeConfig();
      const hostContext = yield* Layer.build(
        makeMimicNodeHostLive(
          getMimicNodeConfig(),
          makeSelfhostPlatformLayers(config).durableEntities,
        ),
      );
      const hostLayer = Layer.succeed(
        HostServiceTag,
        Context.get(hostContext, HostServiceTag),
      );
      const authLayers = makeSelfhostAuthLayers(config.auth);
      const infrastructure = makeBackendInfrastructureLive(config, authLayers.identity).pipe(
        Layer.provide(hostLayer),
      );
      const dependencies = Layer.mergeAll(
        infrastructure,
        AuditLogPort.noop,
        BackendSnapshotHtmlRendererLive,
      );
      const releaseLayer = PaywallReleaseService.layer.pipe(
        Layer.provide(dependencies),
      );

      const result = yield* Effect.gen(function* () {
        const releases = yield* PaywallReleaseService;
        const draft = yield* releases.createRelease(paywallId);
        const loadedDraft = yield* releases.getDraftRelease(paywallId);
        if (loadedDraft?.releaseId !== draft.releaseId) {
          return yield* Effect.die("Draft release lookup returned a different release");
        }
        const published = yield* releases.publishRelease(draft.releaseId);
        return { draft, published };
      }).pipe(
        Effect.provide(releaseLayer),
        Effect.provideService(AuthSession, makeSession(projectId, userId)),
      );

      yield* Effect.sync(() => {
        process.stdout.write(`${resultPrefix}${JSON.stringify(result)}\n`);
      });
    }),
  ) as never,
);
