import { ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import { PaywallNotFoundError } from "../../domain/paywall/Paywall.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  ReleaseStatus,
  and,
  eq,
  paywallReleases,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import {
  componentServingPreviewKey,
  paywallServingHtmlKey,
  sha256Hex,
} from "../paywallDeploys/PaywallDeployManifest.ts";
import { PaywallArtifactStore } from "../paywallDeploys/PaywallArtifactStore.ts";
import { PaywallAssetConfig } from "../paywallLocations/PaywallAssetConfig.ts";
import { collectDeployedComponentContentHashes } from "../paywallThumbnails/PaywallThumbnailService.ts";
import { MimicHost } from "../paywalls/MimicHost.ts";
import { SnapshotHtmlRenderer } from "./SnapshotHtmlRenderer.ts";

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

const CURRENT_SCHEMA_VERSION = 1;
const PREVIEW_STATE = "default";

/** Catch-all error for visual paywall release orchestration failures. */
export class PaywallReleaseError extends Schema.TaggedErrorClass<PaywallReleaseError>(
  "PaywallReleaseError",
)("PaywallReleaseError", {
  cause: Schema.optional(Schema.Unknown),
  message: Schema.String,
}) {}

/** A draft or released row could not be found for the supplied identifier. */
export class ReleaseNotFoundError extends Schema.TaggedErrorClass<ReleaseNotFoundError>(
  "ReleaseNotFoundError",
)("ReleaseNotFoundError", { releaseId: Schema.String }) {}

export interface ReleaseInfo {
  readonly createdAt: Date;
  readonly draftUrl: string;
  readonly releaseId: string;
  readonly version: number;
}

export interface PublishResult {
  readonly htmlUrl: string;
  readonly publishedAt: Date;
  readonly releaseId: string;
  readonly version: number;
}

const artifactUrl = (publicBaseUrl: string, key: string): string =>
  `${publicBaseUrl.replace(/\/$/, "")}/${key}`;

type DomainReleaseError =
  | ActionForbiddenError
  | PaywallNotFoundError
  | PaywallReleaseError
  | ReleaseNotFoundError;

/** Narrows a caught error to the domain errors the service re-raises unchanged. */
const isDomainReleaseError = <E>(error: E): error is Extract<E, DomainReleaseError> =>
  error instanceof ActionForbiddenError ||
  error instanceof PaywallNotFoundError ||
  error instanceof PaywallReleaseError ||
  error instanceof ReleaseNotFoundError;

const preserveDomainErrors = <E>(
  operation: string,
  error: E,
): Extract<E, DomainReleaseError> | PaywallReleaseError => {
  if (isDomainReleaseError(error)) {
    return error;
  }
  return new PaywallReleaseError({
    cause: error,
    message: `Failed to ${operation} paywall release`,
  });
};

/**
 * Creates and publishes visual-editor paywall releases using only provider-neutral
 * database, Mimic, renderer, and object-store boundaries.
 */
export class PaywallReleaseService extends Context.Service<PaywallReleaseService>()(
  "PaywallReleaseService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const auditLog = yield* AuditLogPort;
      const mimicHost = yield* MimicHost;
      const renderer = yield* SnapshotHtmlRenderer;
      const store = yield* PaywallArtifactStore;
      const assetConfig = yield* PaywallAssetConfig;

      const loadPaywallForWrite = Effect.fn("loadPaywallForRelease")(function* (
        paywallId: string,
        action: string,
      ) {
        const session = yield* AuthSession;
        const paywall = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
        if (!paywall) {
          return yield* Effect.fail(
            new PaywallNotFoundError({ message: `Paywall with id ${paywallId} not found` }),
          );
        }
        yield* checkProjectPermission(
          paywall.projectId,
          "project:all",
          `User ${session.user?.id} is not authorized to ${action} paywall ${paywallId}`,
        );
        return { paywall, session };
      });

      const loadComponentTrees = (snapshot: unknown) =>
        Effect.gen(function* () {
          const trees: Record<string, Record<string, unknown>> = {};
          for (const contentHash of collectDeployedComponentContentHashes(snapshot)) {
            const object = yield* store.getObject(
              componentServingPreviewKey(contentHash, PREVIEW_STATE),
            );
            if (object === null) continue;
            const decoded = Option.getOrNull(decodeJson(new TextDecoder().decode(object.body)));
            if (decoded !== null) {
              trees[contentHash] = { [PREVIEW_STATE]: decoded };
            }
          }
          return trees;
        });

      const createRelease = Effect.fn("createPaywallRelease")(
        function* (paywallId: string) {
          const { paywall, session } = yield* loadPaywallForWrite(paywallId, "release");
          if (!session.user?.id) {
            return yield* Effect.fail(
              new PaywallReleaseError({
                message: "User must be authenticated to create a release",
              }),
            );
          }

          yield* mimicHost.ensurePaywallDocument(paywallId);
          const snapshot = yield* mimicHost.getPaywallSnapshot(paywallId);
          const componentTrees = yield* loadComponentTrees(snapshot);
          const existingDraft = yield* db.query.paywallReleases.findFirst({
            orderBy: { version: "desc" },
            where: { paywallId, status: ReleaseStatus.draft },
          });
          const latestReleased = yield* db.query.paywallReleases.findFirst({
            orderBy: { version: "desc" },
            where: { paywallId, status: ReleaseStatus.released },
          });
          const version = (latestReleased?.version ?? 0) + 1;
          const createdAt = yield* DateTime.nowAsDate;
          const html = yield* renderer.render({
            componentTrees,
            metadata: {
              createdAt: createdAt.toISOString(),
              schemaVersion: CURRENT_SCHEMA_VERSION,
              status: "draft",
              version,
            },
            snapshot,
          });
          const body = new TextEncoder().encode(html);
          const contentHash = yield* sha256Hex(body);
          const s3Key = paywallServingHtmlKey(contentHash);
          yield* store.putObject({
            body,
            contentType: "text/html; charset=utf-8",
            key: s3Key,
          });

          const releaseId = existingDraft?.id ?? generateId("paywallRelease");
          if (existingDraft) {
            yield* db
              .update(paywallReleases)
              .set({
                contentHash,
                publishedAt: createdAt,
                publishedBy: session.user.id,
                s3Bucket: store.bucketName,
                s3Key,
                schemaVersion: CURRENT_SCHEMA_VERSION,
                version,
              })
              .where(eq(paywallReleases.id, existingDraft.id));
          } else {
            yield* db.insert(paywallReleases).values({
              contentHash,
              id: releaseId,
              isActive: false,
              paywallId,
              publishedAt: createdAt,
              publishedBy: session.user.id,
              s3Bucket: store.bucketName,
              s3Key,
              schemaVersion: CURRENT_SCHEMA_VERSION,
              status: ReleaseStatus.draft,
              version,
            });
          }

          yield* auditLog.append({
            action: AuditLogAction.Created,
            changes: { version },
            entityId: releaseId,
            entityType: AuditLogEntityType.PaywallRelease,
            parentEntityId: paywallId,
            projectId: paywall.projectId,
          });

          return {
            createdAt,
            draftUrl: artifactUrl(assetConfig.publicBaseUrl, s3Key),
            releaseId,
            version,
          } satisfies ReleaseInfo;
        },
        (effect) => effect.pipe(Effect.mapError((error) => preserveDomainErrors("create", error))),
      );

      const getDraftRelease = Effect.fn("getPaywallDraftRelease")(
        function* (paywallId: string) {
          yield* loadPaywallForWrite(paywallId, "read the draft release for");
          const draft = yield* db.query.paywallReleases.findFirst({
            orderBy: { version: "desc" },
            where: { paywallId, status: ReleaseStatus.draft },
          });
          if (!draft) return null;
          if (draft.publishedAt === null) {
            return yield* Effect.fail(
              new PaywallReleaseError({
                message: `Draft release ${draft.id} has no creation timestamp`,
              }),
            );
          }
          return {
            createdAt: draft.publishedAt,
            draftUrl: artifactUrl(assetConfig.publicBaseUrl, draft.s3Key),
            releaseId: draft.id,
            version: draft.version,
          } satisfies ReleaseInfo;
        },
        (effect) => effect.pipe(Effect.mapError((error) => preserveDomainErrors("read", error))),
      );

      /** Publishes a draft, optionally requiring it to belong to a nested parent paywall. */
      const publishRelease = Effect.fn("publishPaywallRelease")(
        function* (draftId: string, paywallId?: string) {
          const where: { id: string; paywallId?: string; status: number } = {
            id: draftId,
            status: ReleaseStatus.draft,
          };
          if (paywallId !== undefined) where.paywallId = paywallId;
          const draft = yield* db.query.paywallReleases.findFirst({
            where,
          });
          if (!draft) {
            return yield* Effect.fail(new ReleaseNotFoundError({ releaseId: draftId }));
          }
          const { paywall } = yield* loadPaywallForWrite(draft.paywallId, "publish");
          const publishedAt = yield* DateTime.nowAsDate;
          const existing = yield* db.query.paywallReleases.findFirst({
            where: {
              paywallId: draft.paywallId,
              status: ReleaseStatus.released,
              version: draft.version,
            },
          });
          const releaseId = existing?.id ?? generateId("paywallRelease");

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(paywallReleases)
                .set({ isActive: false })
                .where(
                  and(
                    eq(paywallReleases.paywallId, draft.paywallId),
                    eq(paywallReleases.isActive, true),
                  ),
                );
              if (existing) {
                yield* tx
                  .update(paywallReleases)
                  .set({ isActive: true, publishedAt })
                  .where(eq(paywallReleases.id, existing.id));
              } else {
                yield* tx.insert(paywallReleases).values({
                  contentHash: draft.contentHash,
                  id: releaseId,
                  isActive: true,
                  paywallId: draft.paywallId,
                  publishedAt,
                  publishedBy: draft.publishedBy,
                  runtimeConfig: draft.runtimeConfig,
                  s3Bucket: draft.s3Bucket,
                  s3Key: draft.s3Key,
                  schemaVersion: draft.schemaVersion,
                  status: ReleaseStatus.released,
                  version: draft.version,
                });
              }
            }),
          );

          yield* auditLog.append({
            action: AuditLogAction.Published,
            changes: { version: draft.version },
            entityId: releaseId,
            entityType: AuditLogEntityType.PaywallRelease,
            parentEntityId: draft.paywallId,
            projectId: paywall.projectId,
          });

          return {
            htmlUrl: artifactUrl(assetConfig.publicBaseUrl, draft.s3Key),
            publishedAt,
            releaseId,
            version: draft.version,
          } satisfies PublishResult;
        },
        (effect) => effect.pipe(Effect.mapError((error) => preserveDomainErrors("publish", error))),
      );

      return constant({ createRelease, getDraftRelease, publishRelease });
    }),
  },
) {
  static readonly layer = Layer.effect(PaywallReleaseService)(PaywallReleaseService.make);
}
