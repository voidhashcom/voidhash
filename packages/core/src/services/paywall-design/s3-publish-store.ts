/**
 * S3 Publish Store
 *
 * Handles publishing paywall designs to S3 for CDN delivery.
 * Stores immutable versions that can be served via Cloudflare CDN.
 */

import { S3, S3Service } from "@effect-aws/client-s3";
import {
  desc,
  eq,
  paywallPublishedVersions,
  sql,
  type InferSelectModel,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import { Context, Effect, Layer, Option } from "effect";

import { S3PublishError } from "./errors";
import { CURRENT_SCHEMA_VERSION } from "./schema-migration";

/**
 * Published version record from MySQL
 */
export type PublishedVersionRecord = InferSelectModel<
  typeof paywallPublishedVersions
>;

/**
 * Input for publishing a paywall design
 */
export interface PublishInput {
  readonly paywallId: string;
  readonly projectId: string;
  readonly state: unknown;
  readonly publishedBy: string;
}

/**
 * Result of publish operation
 */
export interface PublishResult {
  readonly id: string;
  readonly version: number;
  readonly s3Key: string;
  readonly s3Bucket: string;
}

/**
 * S3 Publish Store service interface
 */
export interface S3PublishStore {
  /**
   * Publish current design state to S3
   */
  readonly publish: (
    input: PublishInput
  ) => Effect.Effect<PublishResult, S3PublishError>;

  /**
   * Get the active published version for a paywall
   */
  readonly getActiveVersion: (
    paywallId: string
  ) => Effect.Effect<Option.Option<PublishedVersionRecord>, S3PublishError>;

  /**
   * Get all published versions for a paywall
   */
  readonly getVersions: (
    paywallId: string
  ) => Effect.Effect<PublishedVersionRecord[], S3PublishError>;

  /**
   * Set a specific version as active
   */
  readonly setActiveVersion: (
    paywallId: string,
    version: number
  ) => Effect.Effect<void, S3PublishError>;
}

/**
 * Context tag for S3PublishStore
 */
export class S3PublishStoreTag extends Context.Tag(
  "PaywallDesign/S3PublishStore"
)<S3PublishStoreTag, S3PublishStore>() {}

/**
 * S3 configuration
 */
export interface S3Config {
  readonly bucket: string;
  readonly endpoint?: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle?: boolean;
}

/**
 * Create S3PublishStore implementation
 */
const makeS3PublishStore = (config: S3Config) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const s3 = yield* S3;
    const bucket = config.bucket;

    // Query to get latest version number
    const getLatestVersionQuery = db.makeQuery((execute, paywallId: string) =>
      execute(async (client) => {
        const result = await client.query.paywallPublishedVersions.findFirst({
          orderBy: [desc(paywallPublishedVersions.version)],
          where: eq(paywallPublishedVersions.paywallId, paywallId),
        });
        return result?.version ?? 0;
      })
    );

    // Query to insert published version record
    const insertVersionQuery = db.makeQuery(
      (
        execute,
        input: {
          id: string;
          paywallId: string;
          s3Key: string;
          s3Bucket: string;
          version: number;
          schemaVersion: number;
          publishedBy: string;
        }
      ) =>
        execute(async (client) => {
          await client.insert(paywallPublishedVersions).values({
            id: input.id,
            isActive: true,
            paywallId: input.paywallId,
            publishedBy: input.publishedBy,
            s3Bucket: input.s3Bucket,
            s3Key: input.s3Key,
            schemaVersion: input.schemaVersion,
            version: input.version,
          });
        })
    );

    // Query to deactivate other versions
    const deactivateOtherVersionsQuery = db.makeQuery(
      (execute, input: { paywallId: string; activeVersionId: string }) =>
        execute(async (client) => {
          await client
            .update(paywallPublishedVersions)
            .set({ isActive: false })
            .where(
              sql`${paywallPublishedVersions.paywallId} = ${input.paywallId} AND ${paywallPublishedVersions.id} != ${input.activeVersionId}`
            );
        })
    );

    // Query to get active version
    const getActiveVersionQuery = db.makeQuery((execute, paywallId: string) =>
      execute(async (client) => {
        const result = await client.query.paywallPublishedVersions.findFirst({
          where: sql`${paywallPublishedVersions.paywallId} = ${paywallId} AND ${paywallPublishedVersions.isActive} = true`,
        });
        return result ?? null;
      })
    );

    // Query to get all versions
    const getVersionsQuery = db.makeQuery((execute, paywallId: string) =>
      execute(async (client) => {
        const results = await client.query.paywallPublishedVersions.findMany({
          orderBy: [desc(paywallPublishedVersions.version)],
          where: eq(paywallPublishedVersions.paywallId, paywallId),
        });
        return results;
      })
    );

    // Query to set active version
    const setActiveQuery = db.makeQuery(
      (execute, input: { paywallId: string; version: number }) =>
        execute(async (client) => {
          // Deactivate all versions for this paywall
          await client
            .update(paywallPublishedVersions)
            .set({ isActive: false })
            .where(eq(paywallPublishedVersions.paywallId, input.paywallId));

          // Activate the specified version
          await client
            .update(paywallPublishedVersions)
            .set({ isActive: true })
            .where(
              sql`${paywallPublishedVersions.paywallId} = ${input.paywallId} AND ${paywallPublishedVersions.version} = ${input.version}`
            );
        })
    );

    const store: S3PublishStore = {
      publish: (input: PublishInput) =>
        Effect.gen(function* () {
          // Get next version number
          const latestVersion = yield* getLatestVersionQuery(input.paywallId).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new S3PublishError({
                  cause: error,
                  operation: "list",
                  paywallId: input.paywallId,
                })
              )
            )
          );

          const newVersion = latestVersion + 1;
          const s3Key = `${input.projectId}/${input.paywallId}/v${newVersion}.json`;
          const versionId = generateId("paywallPublishedVersion");

          // Prepare the content
          const content = JSON.stringify({
            publishedAt: new Date().toISOString(),
            schemaVersion: CURRENT_SCHEMA_VERSION,
            state: input.state,
            version: newVersion,
          });

          // Upload to S3
          yield* s3.putObject({
            Body: content,
            Bucket: bucket,
            ContentType: "application/json",
            Key: s3Key,
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new S3PublishError({
                  cause: error,
                  operation: "upload",
                  paywallId: input.paywallId,
                })
              )
            )
          );

          // Insert version record
          yield* insertVersionQuery({
            id: versionId,
            paywallId: input.paywallId,
            publishedBy: input.publishedBy,
            s3Bucket: bucket,
            s3Key,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            version: newVersion,
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new S3PublishError({
                  cause: error,
                  operation: "upload",
                  paywallId: input.paywallId,
                })
              )
            )
          );

          // Deactivate other versions
          yield* deactivateOtherVersionsQuery({
            activeVersionId: versionId,
            paywallId: input.paywallId,
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new S3PublishError({
                  cause: error,
                  operation: "upload",
                  paywallId: input.paywallId,
                })
              )
            )
          );

          return {
            id: versionId,
            s3Bucket: bucket,
            s3Key,
            version: newVersion,
          };
        }),

      getActiveVersion: (paywallId: string) =>
        getActiveVersionQuery(paywallId).pipe(
          Effect.map((result) =>
            result ? Option.some(result) : Option.none()
          ),
          Effect.catchAll((error) =>
            Effect.fail(
              new S3PublishError({
                cause: error,
                operation: "list",
                paywallId,
              })
            )
          )
        ),

      getVersions: (paywallId: string) =>
        getVersionsQuery(paywallId).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new S3PublishError({
                cause: error,
                operation: "list",
                paywallId,
              })
            )
          )
        ),

      setActiveVersion: (paywallId: string, version: number) =>
        setActiveQuery({ paywallId, version }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new S3PublishError({
                cause: error,
                operation: "upload",
                paywallId,
              })
            )
          )
        ),
    };

    return store;
  });

/**
 * Create layer with config
 */
export const layer = (
  config: S3Config
): Layer.Layer<S3PublishStoreTag, never, Db | S3Service> =>
  Layer.effect(S3PublishStoreTag, makeS3PublishStore(config));

/**
 * Create layer from environment variables
 * @throws {Error} if S3_ACCESS_KEY or S3_SECRET_KEY are not set
 */
export const layerFromEnv = (): Layer.Layer<S3PublishStoreTag, never, Db | S3Service> => {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY environment variables are required");
  }

  return layer({
    accessKeyId,
    bucket: process.env.S3_PAYWALL_BUCKET ?? "voidhash-paywall-designs",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    region: process.env.S3_REGION ?? "us-east-1",
    secretAccessKey,
  });
};

/**
 * Create S3 client layer from environment
 * @throws {Error} if S3_ACCESS_KEY or S3_SECRET_KEY are not set
 */
export const makeS3ClientLayer = (): Layer.Layer<S3Service> => {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY environment variables are required");
  }

  return S3.layer({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    region: process.env.S3_REGION ?? "us-east-1",
  });
};

/**
 * S3 client layer for testing with local S3 (MinIO/RustFS)
 * Uses hardcoded defaults - DO NOT use in production
 */
export const S3ClientLayerTest: Layer.Layer<S3Service> = S3.layer({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "voidhashadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "voidhashadmin",
  },
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  forcePathStyle: true, // Always true for local testing
  region: process.env.S3_REGION ?? "us-east-1",
});

/**
 * @deprecated Use makeS3ClientLayer() for production or S3ClientLayerTest for tests
 */
export const S3ClientLayer = S3ClientLayerTest;

/**
 * Default layer with local development defaults (falls back to test credentials)
 * For production, use layerFromEnv() which validates environment variables are set.
 */
export const Default: Layer.Layer<S3PublishStoreTag, never, Db | S3Service> =
  layer({
    accessKeyId: process.env.S3_ACCESS_KEY ?? "voidhashadmin",
    bucket: process.env.S3_PAYWALL_BUCKET ?? "voidhash-paywall-designs",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || !process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "voidhashadmin",
  });
