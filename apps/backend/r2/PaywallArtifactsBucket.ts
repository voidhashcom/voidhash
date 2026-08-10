import * as Cloudflare from "alchemy/Cloudflare";

export const PaywallArtifactsBucketBinding = "PaywallArtifactsBucket";

/**
 * R2 bucket holding paywall code-deploy artifacts (deploy contract §5):
 *
 * - `blobs/<projectId>/<sha256>` — content-addressed upload staging written by
 *   `PaywallDeployService.uploadBlob`.
 * - `p/<contentHash>/...` — the public, immutable serving layout copied at
 *   finalize and read back by the backend's `GET /p/:contentHash/*` route.
 *
 * One bucket per stage (physical name defaults to `${app}-${stage}-${id}`).
 * Alchemy development uses its local R2 simulator under `.alchemy/local/r2`.
 */
export const PaywallArtifactsBucket = Cloudflare.R2.Bucket(PaywallArtifactsBucketBinding);
