import * as Config from "effect/Config";

const optionalDomain = (name: string): Config.Config<string | undefined> =>
  Config.string(name).pipe(
    Config.map((value) => value.trim() || undefined),
    Config.withDefault(undefined),
  );

/** Custom hostname attached to the Community backend Worker for live deployments. */
export const CommunityBackendDomain = optionalDomain("VOIDHASH_BACKEND_DOMAIN");

/** Custom hostname attached to the Community web Worker for live deployments. */
export const CommunityWwwDomain = optionalDomain("VOIDHASH_WWW_DOMAIN");

/** Whether live Community Workers remain available on their `workers.dev` URLs. */
export const CommunityWorkersDevEnabled = Config.boolean("VOIDHASH_WORKERS_DEV_ENABLED").pipe(
  Config.withDefault(true),
);
