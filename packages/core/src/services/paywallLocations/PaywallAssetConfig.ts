import * as Context from "effect/Context";

/**
 * Public endpoints used to build URLs for paywall release HTML stored in
 * object storage.
 *
 * Two distinct bases because the two release kinds are served differently:
 *
 * - `cdnUrl` — legacy visual-editor releases. URLs are
 *   `{cdnUrl}/{s3Bucket}/{s3Key}` (the CDN exposes the bucket by name).
 * - `publicBaseUrl` — content-addressed code and current visual-editor releases
 *   (deploy contract §5). URLs are
 *   `{publicBaseUrl}/{s3Key}` where `s3Key = "p/<contentHash>/index.html"`,
 *   served by the backend's public `GET /p/:contentHash/*` route (or a CDN
 *   configured with the same layout). No trailing slash.
 *
 * Kept separate from the larger S3/static-hosting port because consumers in
 * `packages/core` (`PaywallLocationService`, `PaywallDeployService`) only
 * need to format URLs — they never touch the bucket directly. The
 * application root wires this from the same secret store as the
 * asset-storage adapter.
 */
export interface PaywallAssetConfigShape {
  readonly cdnUrl: string;
  readonly publicBaseUrl: string;
}

export class PaywallAssetConfig extends Context.Service<
  PaywallAssetConfig,
  PaywallAssetConfigShape
>()("infrastructure/PaywallAssetConfig") {}
