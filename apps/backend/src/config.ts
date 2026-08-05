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
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const optionalBooleanFromEnv = (name: string): boolean | undefined => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

export type SelfhostMode = "local-evaluation" | "production";

const readSelfhostMode = (): SelfhostMode => {
  const mode = process.env.SELFHOST_MODE?.trim();
  if (mode === "local-evaluation" || mode === "production") return mode;
  throw new Error("SELFHOST_MODE must be explicitly set to local-evaluation or production");
};

const isHttpsUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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
  if (process.env.CLICKHOUSE_URL?.trim()) {
    requiredSecrets.push(
      "CLICKHOUSE_ADMIN_PASSWORD",
      "CLICKHOUSE_PASSWORD",
      "CLICKHOUSE_RO_PASSWORD",
      "CLICKHOUSE_ANALYTICS_QUERY_PASSWORD",
    );
  }
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

/** A named ClickHouse connection used by the self-host analytics runtime. */
export interface SelfhostClickhouseConnection {
  readonly database: string;
  readonly password: string;
  readonly url: string;
  readonly username: string;
}

/** ClickHouse administrative and least-privilege runtime connections. */
export interface SelfhostClickhouseConfig {
  readonly admin: SelfhostClickhouseConnection;
  readonly analyticsQuery: SelfhostClickhouseConnection;
  readonly readOnly: SelfhostClickhouseConnection;
  readonly readWrite: SelfhostClickhouseConnection;
}

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
  readonly clickhouse?: SelfhostClickhouseConfig;
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

/** Reads optional ClickHouse configuration, returning undefined when analytics is disabled. */
export const getSelfhostClickhouseConfig = (): SelfhostClickhouseConfig | undefined => {
  const url = process.env.CLICKHOUSE_URL?.trim();
  if (!url) return undefined;
  const database = process.env.CLICKHOUSE_DATABASE?.trim() || "voidhash";
  const connection = (username: string, password: string): SelfhostClickhouseConnection => ({
    database,
    password,
    url,
    username,
  });
  return {
    admin: connection(
      process.env.CLICKHOUSE_ADMIN_USERNAME?.trim() || "voidhash_admin",
      process.env.CLICKHOUSE_ADMIN_PASSWORD ?? "password",
    ),
    analyticsQuery: connection(
      process.env.CLICKHOUSE_ANALYTICS_QUERY_USERNAME?.trim() || "voidhash_query",
      process.env.CLICKHOUSE_ANALYTICS_QUERY_PASSWORD ?? "password",
    ),
    readOnly: connection(
      process.env.CLICKHOUSE_RO_USERNAME?.trim() || "voidhash_ro",
      process.env.CLICKHOUSE_RO_PASSWORD ?? "password",
    ),
    readWrite: connection(
      process.env.CLICKHOUSE_USERNAME?.trim() || "voidhash_app",
      process.env.CLICKHOUSE_PASSWORD ?? "password",
    ),
  };
};

/** Reads the shared application database connection from environment variables. */
export const getSelfhostDatabaseConfig = (): DbConfig => {
  const ssl = optionalBooleanFromEnv("DATABASE_SSL");
  return {
    databaseName: process.env.DATABASE_NAME?.trim() || "voidhash",
    host: process.env.DATABASE_HOST?.trim() || "127.0.0.1",
    password: process.env.DATABASE_PASSWORD ?? "password",
    port: positiveIntegerFromEnv("DATABASE_PORT", 5432),
    ...(ssl === undefined ? {} : { ssl }),
    username: process.env.DATABASE_USERNAME?.trim() || "voidhash",
  };
};

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
  const ssl = optionalBooleanFromEnv("DATABASE_DIRECT_SSL");
  return {
    ...fallback,
    databaseName: process.env.DATABASE_DIRECT_NAME?.trim() || fallback.databaseName,
    host: process.env.DATABASE_DIRECT_HOST?.trim() || fallback.host,
    password: process.env.DATABASE_DIRECT_PASSWORD ?? fallback.password,
    port: positiveIntegerFromEnv("DATABASE_DIRECT_PORT", fallback.port),
    ...(ssl === undefined ? {} : { ssl }),
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
): DbConfig => {
  const ssl = optionalBooleanFromEnv("DATABASE_PLATFORM_SSL");
  return {
    ...fallback,
    databaseName: process.env.DATABASE_PLATFORM_NAME?.trim() || fallback.databaseName,
    host: process.env.DATABASE_PLATFORM_HOST?.trim() || fallback.host,
    password: process.env.DATABASE_PLATFORM_PASSWORD ?? fallback.password,
    port: positiveIntegerFromEnv("DATABASE_PLATFORM_PORT", fallback.port),
    ...(ssl === undefined ? {} : { ssl }),
    username: process.env.DATABASE_PLATFORM_USERNAME?.trim() || fallback.username,
  };
};

/** Reads the SMTP transport and default sender configuration. */
export const getSelfhostSmtpConfig = (): SmtpMailerConfig => {
  const username = process.env.SMTP_USERNAME?.trim() || undefined;
  const password = process.env.SMTP_PASSWORD || undefined;
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
    ...(username === undefined ? {} : { username }),
    ...(password === undefined ? {} : { password: Redacted.make(password) }),
  };
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
  const clickhouse = getSelfhostClickhouseConfig();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const defaultProvider = openaiApiKey ? "openai" : "anthropic";
  const defaultModelId = openaiApiKey ? "gpt-5.4" : "claude-sonnet-4-6";

  return {
    agent: {
      provider: process.env.VOIDHASH_AGENT_MODEL_PROVIDER?.trim() || defaultProvider,
      modelId: process.env.VOIDHASH_AGENT_MODEL_ID?.trim() || defaultModelId,
      visionProvider: process.env.VOIDHASH_AGENT_VISION_MODEL_PROVIDER?.trim() || defaultProvider,
      visionModelId: process.env.VOIDHASH_AGENT_VISION_MODEL_ID?.trim() || defaultModelId,
      ...(openaiApiKey === undefined ? {} : { openaiApiKey: Redacted.make(openaiApiKey) }),
      ...(anthropicApiKey === undefined ? {} : { anthropicApiKey: Redacted.make(anthropicApiKey) }),
      ...(process.env.OPENAI_BASE_URL?.trim()
        ? { openaiBaseUrl: process.env.OPENAI_BASE_URL.trim() }
        : {}),
    },
    artifactObjectStore: {
      ...objectStore,
      bucketName: process.env.S3_ARTIFACT_BUCKET?.trim() || "voidhash-artifacts",
    },
    auth: getSelfhostAuthConfig(),
    database: getSelfhostDatabaseConfig(),
    ...(clickhouse === undefined ? {} : { clickhouse }),
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
