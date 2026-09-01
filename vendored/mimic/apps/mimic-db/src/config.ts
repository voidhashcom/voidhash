import { constant } from "@voidhash/lib/lang";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

/**
 * Runtime configuration for mimic-db.
 *
 * Values are read from `process.env` in every supported platform entry point.
 */

export interface MimicConfig {
  /** Bootstrap superuser, created on first control-plane access. */
  readonly rootUsername: string;
  readonly rootPassword: string;
  /** Allowed CORS origins for the RPC + WebSocket endpoints. */
  readonly corsOrigins: readonly string[];
  /** Take a durable snapshot after this many appended commands. */
  readonly snapshotEveryCommands: number;
  /** WebSocket heartbeat interval (ms). */
  readonly heartbeatMs: number;
  /** Presence entry time-to-live (ms). */
  readonly presenceTtlMs: number;
  /**
   * Debounce window (ms) after the last authenticated collaborator disconnects
   * before a dirty document publishes an idle notification. Absorbs quick
   * reconnects so a single reload does not fire a notification.
   */
  readonly idleNotifyDebounceMs: number;
  /**
   * Public base URL used as the primary authority for document-token
   * connection URLs. `undefined` when `MIMIC_PUBLIC_BASE_URL` is unset or
   * blank — callers then derive scheme/host from the incoming request.
   */
  readonly publicBaseUrl: Option.Option<string>;
}

const positiveInt = (value: Option.Option<string>, fallback: number): number => {
  const parsed = Number.parseInt(
    Option.getOrElse(value, () => ""),
    10,
  );
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const DEFAULT_CORS_ORIGINS = constant([
  "https://mimic-admin.voidhash.localhost",
  "https://mimic-example.voidhash.localhost",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:4460",
  "http://localhost:3003",
]);

const parseCorsAllowedOrigins = (env: Option.Option<string>): readonly string[] =>
  Option.getOrElse(env, () => "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const configEffect = Effect.gen(function* () {
  const corsOrigins = yield* Config.option(Config.string("CORS_ORIGINS"));
  const snapshotEveryCommands = yield* Config.option(
    Config.string("MIMIC_DOCUMENT_SNAPSHOT_EVERY_COMMANDS"),
  );
  const heartbeatMs = yield* Config.option(Config.string("MIMIC_DOCUMENT_HEARTBEAT_MS"));
  const presenceTtlMs = yield* Config.option(Config.string("MIMIC_DOCUMENT_PRESENCE_TTL_MS"));
  const idleNotifyDebounceMs = yield* Config.option(
    Config.string("MIMIC_DOCUMENT_IDLE_NOTIFY_DEBOUNCE_MS"),
  );
  const publicBaseUrl = yield* Config.option(Config.string("MIMIC_PUBLIC_BASE_URL"));
  const configuredCorsOrigins = Option.filter(corsOrigins, (value) => value.trim() !== "");
  return {
    rootUsername: yield* Config.string("ROOT_USERNAME").pipe(
      Config.map((value) => value.trim() || "root"),
      Config.withDefault("root"),
    ),
    rootPassword: Redacted.value(
      yield* Config.redacted("ROOT_PASSWORD").pipe(Config.withDefault(Redacted.make("password"))),
    ),
    corsOrigins: Option.isSome(configuredCorsOrigins)
      ? parseCorsAllowedOrigins(configuredCorsOrigins)
      : DEFAULT_CORS_ORIGINS,
    snapshotEveryCommands: positiveInt(snapshotEveryCommands, 100),
    heartbeatMs: positiveInt(heartbeatMs, 30_000),
    presenceTtlMs: positiveInt(presenceTtlMs, 75_000),
    idleNotifyDebounceMs: positiveInt(idleNotifyDebounceMs, 15_000),
    publicBaseUrl: Option.filter(
      Option.map(publicBaseUrl, (value) => value.trim()),
      (value) => value !== "",
    ),
  } satisfies MimicConfig;
}).pipe(Effect.orDie);

const loadConfig = (): MimicConfig =>
  EffectRuntime.runSync(
    configEffect.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv()))),
  );

export const getCorsAllowedOrigins = (): readonly string[] => loadConfig().corsOrigins;

export const getConfig = (): MimicConfig => loadConfig();
