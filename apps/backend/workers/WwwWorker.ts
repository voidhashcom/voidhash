import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import {
  CommunityWorkersDevEnabled,
  CommunityWwwDomain,
} from "../infrastructure/DeploymentConfig.ts";

export interface CommunityWebsiteConfig {
  readonly apiUrl: Alchemy.Input<string>;
}

/** Deploys the Community TanStack application as an Alchemy-managed Worker. */
export const CommunityWebsite = Effect.fnUntraced(function* (config: CommunityWebsiteConfig) {
  const path = yield* Path.Path;
  const wwwRootDir = path.fromFileUrl(new URL("../../../apps/www", import.meta.url));
  const { stage } = yield* Alchemy.Stack;
  const dev = Option.match(yield* Effect.serviceOption(Alchemy.AlchemyContext), {
    onNone: () => false,
    onSome: (context) => context.dev,
  });
  const configuredDomain = yield* CommunityWwwDomain;
  const domain = Match.value(dev).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => Option.getOrUndefined(configuredDomain)),
  );
  const apiUrl = Match.value(dev).pipe(
    Match.when(true, () => "http://localhost:8787"),
    Match.orElse(() => config.apiUrl),
  );
  const appEnvironment = Match.value(stage).pipe(
    Match.when("production", () => "production"),
    Match.when("preview", () => "preview"),
    Match.orElse(() => "development"),
  );

  return yield* Cloudflare.Website.Vite("CommunityWww", {
    rootDir: wwwRootDir,
    domain,
    workersDev: {
      enabled: yield* CommunityWorkersDevEnabled,
      previewsEnabled: false,
    },
    compatibility: { date: "2026-03-17", flags: ["nodejs_compat"] },
    dev: { host: "0.0.0.0", port: 3000, strictPort: true },
    env: {
      VITE_APP_API_URL: apiUrl,
      VITE_APP_ENV: appEnvironment,
      VOIDHASH_AUTH_SECRET: Config.redacted("VOIDHASH_AUTH_SECRET"),
      VOIDHASH_ROOT_EMAIL: Config.string("VOIDHASH_ROOT_EMAIL").pipe(
        Config.withDefault("root@voidhash.local"),
      ),
      VOIDHASH_ROOT_PASSWORD: Config.redacted("VOIDHASH_ROOT_PASSWORD"),
      VOIDHASH_ROOT_USERNAME: Config.string("VOIDHASH_ROOT_USERNAME").pipe(
        Config.withDefault("root"),
      ),
    },
  });
});
