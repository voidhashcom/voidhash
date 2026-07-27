import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link PaywallArtifactStore} operations. Adapters wrap
 * any storage-backend failure (S3/R2 SDK errors, network failures) into this
 * single tag so the {@link PaywallDeployService} catch boundary stays small.
 */
export class PaywallArtifactStoreError extends Schema.TaggedErrorClass<PaywallArtifactStoreError>(
  "PaywallArtifactStoreError",
)("PaywallArtifactStoreError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface PaywallArtifactObject {
  readonly body: Uint8Array;
  readonly contentType: string | null;
}

export interface PaywallArtifactHead {
  readonly size: number;
}

export interface PaywallArtifactStoreShape {
  /**
   * Logical bucket name recorded on `paywall_release.s3Bucket` rows and used
   * by URL builders (`{cdnUrl}/{bucket}/{key}`). Carried on the port — not a
   * separate config service — because every adapter already knows which
   * bucket it writes to, and release rows must record exactly that bucket.
   */
  readonly bucketName: string;

  /** Writes raw bytes at `key`, overwriting any existing object (idempotent). */
  readonly putObject: (input: {
    readonly key: string;
    readonly body: Uint8Array;
    readonly contentType: string | undefined;
  }) => Effect.Effect<void, PaywallArtifactStoreError>;

  /** Reads the object at `key`; `null` when it does not exist. */
  readonly getObject: (
    key: string,
  ) => Effect.Effect<PaywallArtifactObject | null, PaywallArtifactStoreError>;

  /** Object metadata without the body; `null` when it does not exist. */
  readonly head: (
    key: string,
  ) => Effect.Effect<PaywallArtifactHead | null, PaywallArtifactStoreError>;
}

/**
 * Provider-agnostic port for the object store holding paywall deploy blobs
 * (upload layout `blobs/<projectId>/<sha256>`) and the public serving layout
 * (`p/<contentHash>/...`, contract §5). The live adapter (S3/R2) is wired by
 * the application root — core code only touches the tag, keeping storage SDK
 * dependencies out of `packages/core` and the service trivially fakeable in
 * tests with an in-memory map.
 */
export class PaywallArtifactStore extends Context.Service<
  PaywallArtifactStore,
  PaywallArtifactStoreShape
>()("infrastructure/PaywallArtifactStore") {}
