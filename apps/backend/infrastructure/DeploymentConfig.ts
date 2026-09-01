import * as Config from "effect/Config";
import * as Option from "effect/Option";

const optionalDomain = (name: string): Config.Config<Option.Option<string>> =>
  Config.string(name).pipe(
    Config.map((value) => Option.liftPredicate((domain: string) => domain !== "")(value.trim())),
    Config.withDefault(Option.none()),
  );

/** Custom hostname attached to the Community backend Worker for live deployments. */
export const CommunityBackendDomain = optionalDomain("VOIDHASH_BACKEND_DOMAIN");

/** Custom hostname attached to the Community web Worker for live deployments. */
export const CommunityWwwDomain = optionalDomain("VOIDHASH_WWW_DOMAIN");

/** Whether live Community Workers remain available on their `workers.dev` URLs. */
export const CommunityWorkersDevEnabled = Config.boolean("VOIDHASH_WORKERS_DEV_ENABLED").pipe(
  Config.withDefault(true),
);
