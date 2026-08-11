// This module is the self-host deployment's synchronous `process.env` adapter: every
// export is a plain function that reads environment variables and returns a concrete
// config record. Its results are consumed from synchronous call sites — including the
// pre-runtime bootstrap path that builds the layers — so there is no Effect runtime in
// scope in which a `Config` provider could be used.
// oxlint-disable effect/noGlobals -- synchronous process.env adapter; callers read these config records from synchronous positions before any Effect runtime exists.
import type { DbConfig } from "@voidhash/db/db";
import type { SmtpMailerConfig } from "@voidhash/platform-selfhost/Mailer";
import type { S3ObjectStoreConfig } from "@voidhash/platform-selfhost/ObjectStore";
import {
  isPlaceholderSecret,
  resolveStandaloneAuthConfig,
  standaloneAuthConfigIssues,
} from "@voidhash/core/services/auth/StandaloneAuthConfig";
import { Redacted } from "effect";

const positiveIntegerFromEnv = (name: string, fallback: number): number => {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- synchronous env parser returning a plain `number`; making it fail in Effect would force every synchronous config call site in this module into an Effect.
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const optionalBooleanFromEnv = (name: string): boolean | undefined => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- synchronous env parser returning `boolean | undefined`; making it fail in Effect would force every synchronous config call site in this module into an Effect.
  throw new Error(`${name} must be true or false`);
};

/**
 * Reads an optional boolean override as a spreadable fragment. The key is
 * omitted entirely when unset, because {@link DbConfig} consumers distinguish
 * "no `ssl` key" (driver default) from an explicit `false`.
 */
const sslOverrideFromEnv = (name: string): { readonly ssl?: boolean } => {
  const ssl = optionalBooleanFromEnv(name);
  if (ssl === undefined) return {};
  return { ssl };
};

export type SelfhostMode = "local-evaluation" | "production";

const readSelfhostMode = (): SelfhostMode => {
  const mode = process.env.SELFHOST_MODE?.trim();
  if (mode === "local-evaluation" || mode === "production") return mode;
  // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- synchronous env reader with a plain `SelfhostMode` return type; callers read it from synchronous positions on the pre-runtime bootstrap path, so a tagged Effect failure has nowhere to go.
  throw new Error("SELFHOST_MODE must be explicitly set to local-evaluation or production");
};

const isHttpsUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  if (!URL.canParse(value)) return false;
  return new URL(value).protocol === "https:";
};

/**
 * Refuses evaluation credentials and insecure public URLs in production mode.
 *
 * The standalone identity provider is production-grade, so unlike the earlier
 * development provider it is not refused here — what is refused is running it on
 * the documented evaluation defaults, which are public knowledge.
 */
export const validateSelfhostSecurityConfig = (): SelfhostMode => {
  const mode = readSelfhostMode();
  if (mode === "local-evaluation") return mode;

  const unsafeSettings: Array<string> = [...standaloneAuthConfigIssues()];
  const requiredSecrets = ["DATABASE_PASSWORD", "MIMIC_ROOT_PASSWORD", "S3_SECRET_ACCESS_KEY"];
  for (const name of requiredSecrets) {
    if (isPlaceholderSecret(process.env[name])) unsafeSettings.push(name);
  }
  if (!process.env.OPENAI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
    unsafeSettings.push("OPENAI_API_KEY or ANTHROPIC_API_KEY");
  }

  for (const name of ["PUBLIC_BASE_URL", "PUBLIC_FILES_BASE_URL", "MIMIC_PUBLIC_BASE_URL"]) {
    if (!isHttpsUrl(process.env[name])) unsafeSettings.push(name);
  }

  if (unsafeSettings.length > 0) {
    // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- synchronous self-host bootstrap guard: this runs from the process entrypoint before any Effect runtime exists, and a throw is the only way to abort the boot with a readable message.
    throw new Error(
      `Production self-host security validation failed for: ${unsafeSettings.join(", ")}`,
    );
  }
  return mode;
};

/**
 * The single root identity and the key its session tokens are signed with.
 *
 * Self-host is single-player: these credentials are the only way in, and there
 * is no code path that can create a second user.
 */
export interface SelfhostAuthConfig {
  readonly rootUsername: string;
  readonly rootPassword: Redacted.Redacted<string>;
  readonly rootEmail: string;
  readonly secret: Redacted.Redacted<string>;
}

/**
 * Reads the standalone identity configuration. Evaluation defaults apply when
 * the variables are unset; {@link validateSelfhostSecurityConfig} is what
 * refuses those defaults in production.
 */
export const getSelfhostAuthConfig = (): SelfhostAuthConfig => {
  const resolved = resolveStandaloneAuthConfig();
  return {
    rootEmail: resolved.rootEmail,
    rootPassword: Redacted.make(resolved.rootPassword),
    rootUsername: resolved.rootUsername,
    secret: Redacted.make(resolved.secret),
  };
};

/** BYO-provider configuration for durable self-hosted agent sessions. */
export interface SelfhostAgentConfig {
  readonly provider: string;
  readonly modelId: string;
  readonly visionProvider: string;
  readonly visionModelId: string;
  readonly openaiApiKey?: Redacted.Redacted<string>;
  readonly anthropicApiKey?: Redacted.Redacted<string>;
  readonly openaiBaseUrl?: string;
}

/** Configuration for the single-process self-host runtime. */
export interface SelfhostRuntimeConfig {
  readonly agent: SelfhostAgentConfig;
  readonly auth: SelfhostAuthConfig;
  readonly componentCompilerUrl: string;
  readonly database: DbConfig;
  readonly host: string;
  readonly mailer: SmtpMailerConfig;
  /**
   * Where platform state lives: cluster mailboxes, workflow executions,
   * persisted queues, entity alarms, and the key-value store. Defaults to
   * {@link SelfhostRuntimeConfig.database}.
   */
  readonly platformDatabase: DbConfig;
  readonly port: number;
  readonly publicBaseUrl: string;
  readonly publicFilesBaseUrl: string;
  readonly publicObjectStore: S3ObjectStoreConfig;
  readonly artifactObjectStore: S3ObjectStoreConfig;
}

/** Reads the shared application database connection from environment variables. */
export const getSelfhostDatabaseConfig = (): DbConfig => ({
  databaseName: process.env.DATABASE_NAME?.trim() || "voidhash",
  host: process.env.DATABASE_HOST?.trim() || "127.0.0.1",
  password: process.env.DATABASE_PASSWORD ?? "password",
  port: positiveIntegerFromEnv("DATABASE_PORT", 5432),
  ...sslOverrideFromEnv("DATABASE_SSL"),
  username: process.env.DATABASE_USERNAME?.trim() || "voidhash",
});

/**
 * Reads the application database connection used by out-of-band tooling that
 * opens its own TCP socket — currently the migration entrypoint, which runs as
 * a separate process before the server starts.
 *
 * Every `DATABASE_DIRECT_*` variable falls back to its `DATABASE_*` counterpart,
 * so operators whose application already dials Postgres directly never set them.
 * They exist for deployments where `DATABASE_HOST` names a sandboxed or proxied
 * endpoint (a connection broker, a Hyperdrive-style local socket) that only
 * resolves inside the runtime serving requests. Migrations need multi-statement
 * SQL and a session-scoped advisory lock, so they always take the origin.
 */
export const getSelfhostMigrationDatabaseConfig = (): DbConfig => {
  const fallback = getSelfhostDatabaseConfig();
  return {
    ...fallback,
    databaseName: process.env.DATABASE_DIRECT_NAME?.trim() || fallback.databaseName,
    host: process.env.DATABASE_DIRECT_HOST?.trim() || fallback.host,
    password: process.env.DATABASE_DIRECT_PASSWORD ?? fallback.password,
    port: positiveIntegerFromEnv("DATABASE_DIRECT_PORT", fallback.port),
    ...sslOverrideFromEnv("DATABASE_DIRECT_SSL"),
    username: process.env.DATABASE_DIRECT_USERNAME?.trim() || fallback.username,
  };
};

/**
 * Reads the database that holds platform state — cluster mailboxes, workflow
 * executions, persisted queues, entity alarms, and the platform key-value store.
 *
 * Every `DATABASE_PLATFORM_*` variable falls back to its `DATABASE_*`
 * counterpart, so a deployment that leaves them unset keeps platform state
 * beside application data in one database, which is the supported shape.
 *
 * Setting `DATABASE_PLATFORM_NAME` moves that state into its own database. The
 * reason it is separable is shard ownership: a single-runner cluster claims
 * *every* shard in the database it is built over, so two processes sharing one
 * database steal each other's messages. That is exactly what a test process does
 * to a running deployment, so `pnpm test:integration` points the suites that
 * build their own topology at a database of their own.
 */
export const getSelfhostPlatformDatabaseConfig = (
  fallback: DbConfig = getSelfhostDatabaseConfig(),
): DbConfig => ({
  ...fallback,
  databaseName: process.env.DATABASE_PLATFORM_NAME?.trim() || fallback.databaseName,
  host: process.env.DATABASE_PLATFORM_HOST?.trim() || fallback.host,
  password: process.env.DATABASE_PLATFORM_PASSWORD ?? fallback.password,
  port: positiveIntegerFromEnv("DATABASE_PLATFORM_PORT", fallback.port),
  ...sslOverrideFromEnv("DATABASE_PLATFORM_SSL"),
  username: process.env.DATABASE_PLATFORM_USERNAME?.trim() || fallback.username,
});

/** Omits SMTP credentials entirely when the transport is unauthenticated. */
const smtpCredentials = (): {
  readonly username?: string;
  readonly password?: Redacted.Redacted<string>;
} => {
  const credentials: { username?: string; password?: Redacted.Redacted<string> } = {};
  const username = process.env.SMTP_USERNAME?.trim();
  if (username) credentials.username = username;
  const password = process.env.SMTP_PASSWORD;
  if (password) credentials.password = Redacted.make(password);
  return credentials;
};

/** Reads the SMTP transport and default sender configuration. */
export const getSelfhostSmtpConfig = (): SmtpMailerConfig => {
  return {
    defaultFrom: {
      address: process.env.SMTP_FROM_ADDRESS?.trim() || "noreply@voidhash.local",
      name: process.env.SMTP_FROM_NAME?.trim() || "Voidhash",
    },
    host: process.env.SMTP_HOST?.trim() || "127.0.0.1",
    port: positiveIntegerFromEnv("SMTP_PORT", 1025),
    requireTls: optionalBooleanFromEnv("SMTP_REQUIRE_TLS") ?? false,
    secure: optionalBooleanFromEnv("SMTP_SECURE") ?? false,
    tlsRejectUnauthorized: optionalBooleanFromEnv("SMTP_TLS_REJECT_UNAUTHORIZED") ?? true,
    verifyOnStart: optionalBooleanFromEnv("SMTP_VERIFY_ON_START") ?? false,
    ...smtpCredentials(),
  };
};

/** The provider and model used when the operator pins neither explicitly. */
const defaultAgentModel = (
  openaiApiKey: string | undefined,
): { readonly provider: string; readonly modelId: string } => {
  if (openaiApiKey) return { modelId: "gpt-5.4", provider: "openai" };
  return { modelId: "claude-sonnet-4-6", provider: "anthropic" };
};

/** Omits BYO provider keys that were never configured. */
const agentApiKeys = (
  openaiApiKey: string | undefined,
  anthropicApiKey: string | undefined,
): {
  readonly openaiApiKey?: Redacted.Redacted<string>;
  readonly anthropicApiKey?: Redacted.Redacted<string>;
} => {
  const keys: {
    openaiApiKey?: Redacted.Redacted<string>;
    anthropicApiKey?: Redacted.Redacted<string>;
  } = {};
  if (openaiApiKey !== undefined) keys.openaiApiKey = Redacted.make(openaiApiKey);
  if (anthropicApiKey !== undefined) keys.anthropicApiKey = Redacted.make(anthropicApiKey);
  return keys;
};

/** Omits the OpenAI-compatible base URL unless an override is configured. */
const agentOpenaiBaseUrl = (): { readonly openaiBaseUrl?: string } => {
  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim();
  if (!openaiBaseUrl) return {};
  return { openaiBaseUrl };
};

/** Reads and validates the complete single-process runtime configuration. */
export const getSelfhostRuntimeConfig = (): SelfhostRuntimeConfig => {
  validateSelfhostSecurityConfig();
  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim() || "http://localhost:5001";
  const endpoint = process.env.S3_ENDPOINT?.trim() || "http://127.0.0.1:9000";
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() || "voidhash";
  const secretAccessKey = Redacted.make(process.env.S3_SECRET_ACCESS_KEY ?? "password");
  const objectStore = {
    accessKeyId,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    region,
    secretAccessKey,
  };
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const { modelId: defaultModelId, provider: defaultProvider } = defaultAgentModel(openaiApiKey);

  return {
    agent: {
      provider: process.env.VOIDHASH_AGENT_MODEL_PROVIDER?.trim() || defaultProvider,
      modelId: process.env.VOIDHASH_AGENT_MODEL_ID?.trim() || defaultModelId,
      visionProvider: process.env.VOIDHASH_AGENT_VISION_MODEL_PROVIDER?.trim() || defaultProvider,
      visionModelId: process.env.VOIDHASH_AGENT_VISION_MODEL_ID?.trim() || defaultModelId,
      ...agentApiKeys(openaiApiKey, anthropicApiKey),
      ...agentOpenaiBaseUrl(),
    },
    artifactObjectStore: {
      ...objectStore,
      bucketName: process.env.S3_ARTIFACT_BUCKET?.trim() || "voidhash-artifacts",
    },
    auth: getSelfhostAuthConfig(),
    database: getSelfhostDatabaseConfig(),
    componentCompilerUrl: process.env.COMPONENT_COMPILER_URL?.trim() || "http://127.0.0.1:5002",
    host: process.env.HOST?.trim() || "0.0.0.0",
    mailer: getSelfhostSmtpConfig(),
    platformDatabase: getSelfhostPlatformDatabaseConfig(),
    port: positiveIntegerFromEnv("PORT", 5001),
    publicBaseUrl,
    publicFilesBaseUrl: process.env.PUBLIC_FILES_BASE_URL?.trim() || publicBaseUrl,
    publicObjectStore: {
      ...objectStore,
      bucketName: process.env.S3_PUBLIC_BUCKET?.trim() || "voidhash-public",
    },
  };
};
