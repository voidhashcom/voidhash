/**
 * Paywall publishing operations
 *
 * Handles publishing paywall designs to S3 for CDN delivery.
 * 
 * Note: These functions require MySqlSnapshotStoreTag and S3PublishStoreTag
 * to be provided at runtime. This is done in PaywallRpcsLive to avoid 
 * polluting PaywallService.Default's requirements for non-publish operations.
 */

import { Db } from "@voidhash/db/effect";
import { AuthSession, PaywallNotFoundError } from "@voidhash/shared";
import { Effect, Option } from "effect";

import {
  MySqlSnapshotStoreTag,
  S3PublishStoreTag,
} from "../paywall-design";

/**
 * Publish result returned to caller
 */
export interface PublishResult {
  readonly id: string;
  readonly s3Bucket: string;
  readonly s3Key: string;
  readonly version: number;
}

/**
 * Published version info
 */
export interface PublishedVersionInfo {
  readonly id: string;
  readonly isActive: boolean;
  readonly publishedAt: Date;
  readonly s3Bucket: string;
  readonly s3Key: string;
  readonly version: number;
}

/**
 * Helper to get paywall by ID and verify access
 * Duplicates some logic from getPaywallById to avoid circular dependencies
 */
const verifyPaywallAccess = (paywallId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const session = yield* AuthSession;
    
    const paywall = yield* db.use(async (client) => 
      client.query.paywalls.findFirst({
        where: (paywalls, { eq }) => eq(paywalls.id, paywallId),
      })
    );
    
    if (!paywall) {
      return yield* Effect.fail(
        new PaywallNotFoundError({ message: `Paywall ${paywallId} not found` })
      );
    }
    
    // Verify project access
    const hasAccess = session.projects.some(p => p.id === paywall.projectId);
    if (!hasAccess) {
      return yield* Effect.fail(
        new PaywallNotFoundError({ message: `Paywall ${paywallId} not found` })
      );
    }
    
    return paywall;
  });

/**
 * Publish the current paywall design to S3
 * 
 * Returns an effect factory that requires MySqlSnapshotStoreTag, S3PublishStoreTag, 
 * AuthSession, and Db when called. The outer effect only requires Db.
 */
export const publishPaywall = Effect.gen(function* () {
  // Only require Db at service construction time
  // Storage tags are required when the returned function is called
  return (paywallId: string) =>
    Effect.gen(function* () {
      const mysql = yield* MySqlSnapshotStoreTag;
      const s3 = yield* S3PublishStoreTag;
      const session = yield* AuthSession;
      
      // Verify paywall exists and user has access
      const paywall = yield* verifyPaywallAccess(paywallId);

      // Load current design state from MySQL
      const designState = yield* mysql.load(paywallId);
      if (Option.isNone(designState)) {
        return yield* Effect.fail(
          new PaywallNotFoundError({
            message: `No design state found for paywall ${paywallId}`,
          })
        );
      }

      // Publish to S3
      const result = yield* s3.publish({
        paywallId,
        projectId: paywall.projectId,
        publishedBy: session.user?.id ?? "unknown",
        state: designState.value.state,
      });

      return {
        id: result.id,
        s3Bucket: result.s3Bucket,
        s3Key: result.s3Key,
        version: result.version,
      } satisfies PublishResult;
    });
});

/**
 * Get all published versions for a paywall
 * 
 * Returns an effect factory that requires S3PublishStoreTag, AuthSession, and Db when called.
 */
export const getPublishedVersions = Effect.gen(function* () {
  // No service construction requirements
  return (paywallId: string) =>
    Effect.gen(function* () {
      const s3 = yield* S3PublishStoreTag;
      
      // Verify paywall exists and user has access
      yield* verifyPaywallAccess(paywallId);

      const versions = yield* s3.getVersions(paywallId);

      return versions.map(
        (v) =>
          ({
            id: v.id,
            isActive: v.isActive,
            publishedAt: v.publishedAt ?? new Date(),
            s3Bucket: v.s3Bucket,
            s3Key: v.s3Key,
            version: v.version,
          }) satisfies PublishedVersionInfo
      );
    });
});

/**
 * Set a specific version as active
 * 
 * Returns an effect factory that requires S3PublishStoreTag, AuthSession, and Db when called.
 */
export const setActiveVersion = Effect.gen(function* () {
  // No service construction requirements
  return (paywallId: string, version: number) =>
    Effect.gen(function* () {
      const s3 = yield* S3PublishStoreTag;
      
      // Verify paywall exists and user has access
      yield* verifyPaywallAccess(paywallId);

      yield* s3.setActiveVersion(paywallId, version);
    });
});
