import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { DatabaseHyperdrive } from "./infrastructure/Hyperdrive.ts";
import { PaywallArtifactsBucket } from "./r2/PaywallArtifactsBucket.ts";
import { PublicFileStorageBucket } from "./r2/PublicFileStorageBucket.ts";
import { CommunityWebsite } from "./workers/WwwWorker.ts";
import CommunityBackend from "./workers/BackendWorker.ts";

/** Resolved Community Cloudflare deployment outputs. */
export interface CommunityStackOutput {
  readonly backendUrl: string;
  readonly hyperdriveId: string;
  readonly wwwUrl: string;
}

export default Alchemy.Stack(
  "VoidhashCommunity",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const hyperdrive = yield* DatabaseHyperdrive;
    yield* PaywallArtifactsBucket;
    yield* PublicFileStorageBucket;
    const backend = yield* CommunityBackend;
    const www = yield* CommunityWebsite({ apiUrl: backend.url.as<string>() });

    return {
      backendUrl: backend.url,
      hyperdriveId: hyperdrive.hyperdriveId,
      wwwUrl: www.url,
    };
  }),
);
