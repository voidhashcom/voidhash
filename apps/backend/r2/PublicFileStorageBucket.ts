import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

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
export const PublicFileStorageBucket = Effect.gen(function* () {
  const sharedResource = yield* Config.string("VOIDHASH_PUBLIC_FILES_RESOURCE").pipe(
    Config.withDefault(""),
  );
  return sharedResource === ""
    ? yield* Cloudflare.R2.Bucket(PublicFileStorageBucketBinding)
    : yield* Cloudflare.R2.Bucket.ref(sharedResource);
}).pipe(Effect.orDie);
