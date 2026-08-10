import * as Cloudflare from "alchemy/Cloudflare";

export const PublicFileStorageBucketBinding = "PublicFileStorageBucket";

/**
 * Unified R2 bucket for public assets (avatars today under
 * `avatars/<entity>/<id>/<sha256>.<ext>`, room for more public files later),
 * served by this worker's public `GET /files/*` route. Kept separate from
 * {@link PaywallArtifactsBucket} so the two have independent lifecycles.
 *
 * One bucket per stage (physical name defaults to `${app}-${stage}-${id}`).
 * Alchemy development uses its local R2 simulator under `.alchemy/local/r2`.
 */
export const PublicFileStorageBucket = Cloudflare.R2.Bucket(PublicFileStorageBucketBinding);
