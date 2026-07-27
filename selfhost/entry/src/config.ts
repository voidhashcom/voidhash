import type { DbConfig } from "@voidhash/db/db";
import type { SmtpMailerConfig } from "@voidhash/platform-node/Mailer";
import type { S3ObjectStoreConfig } from "@voidhash/platform-node/ObjectStore";
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

const requiredInProduction = (name: string, developmentFallback: string): string => {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (readSelfhostMode() === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
};

export type SelfhostMode = "local-evaluation" | "production";

const readSelfhostMode = (): SelfhostMode => {
  const mode = process.env.SELFHOST_MODE?.trim();
  if (mode === "local-evaluation" || mode === "production") return mode;
  throw new Error("SELFHOST_MODE must be explicitly set to local-evaluation or production");
};

const isExampleSecret = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "password" ||
    normalized.includes("not_configured") ||
    normalized.includes("change-me") ||
    normalized.includes("replace-me") ||
    normalized.startsWith("replace-with-")
  );
};

const isHttpsUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Refuses evaluation credentials and insecure public URLs in production mode. */
export const validateSelfhostSecurityConfig = (): SelfhostMode => {
  const mode = readSelfhostMode();
  if (mode === "local-evaluation") return mode;

  const unsafeSettings: Array<string> = [];
  const requiredSecrets = [
    "DATABASE_PASSWORD",
    "MIMIC_ROOT_PASSWORD",
    "S3_SECRET_ACCESS_KEY",
    "WORKOS_API_KEY",
    "WORKOS_CLIENT_ID",
    "WORKOS_COOKIE_PASSWORD",
    "WORKOS_WEBHOOK_SECRET",
  ];
  if (process.env.CLICKHOUSE_URL?.trim()) {
    requiredSecrets.push(
      "CLICKHOUSE_ADMIN_PASSWORD",
      "CLICKHOUSE_PASSWORD",
      "CLICKHOUSE_RO_PASSWORD",
      "CLICKHOUSE_ANALYTICS_QUERY_PASSWORD",
    );
  }
  for (const name of requiredSecrets) {
    if (isExampleSecret(process.env[name])) unsafeSettings.push(name);
  }
  if (!process.env.OPENAI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
    unsafeSettings.push("OPENAI_API_KEY or ANTHROPIC_API_KEY");
  }

  for (const name of [
    "PUBLIC_BASE_URL",
    "PUBLIC_FILES_BASE_URL",
    "MIMIC_PUBLIC_BASE_URL",
    "WORKOS_REDIRECT_URI",
  ]) {
    if (!isHttpsUrl(process.env[name])) unsafeSettings.push(name);
  }

  if (unsafeSettings.length > 0) {
    throw new Error(
      `Production self-host security validation failed for: ${unsafeSettings.join(", ")}`,
    );
  }
  return mode;
};

/** WorkOS credentials supplied by a Community Edition operator. */
export interface SelfhostWorkosConfig {
  readonly apiKey: string;
  readonly clientId: string;
  readonly cookieName: string;
  readonly cookiePassword: string;
  readonly webhookSecret: string;
}

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
  readonly clickhouse?: SelfhostClickhouseConfig;
  readonly componentCompilerUrl: string;
  readonly database: DbConfig;
  readonly host: string;
  readonly mailer: SmtpMailerConfig;
  readonly port: number;
  readonly publicBaseUrl: string;
  readonly publicFilesBaseUrl: string;
  readonly publicObjectStore: S3ObjectStoreConfig;
  readonly artifactObjectStore: S3ObjectStoreConfig;
  readonly workos: SelfhostWorkosConfig;
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
    database: getSelfhostDatabaseConfig(),
    ...(clickhouse === undefined ? {} : { clickhouse }),
    componentCompilerUrl: process.env.COMPONENT_COMPILER_URL?.trim() || "http://127.0.0.1:5002",
    host: process.env.HOST?.trim() || "0.0.0.0",
    mailer: getSelfhostSmtpConfig(),
    port: positiveIntegerFromEnv("PORT", 5001),
    publicBaseUrl,
    publicFilesBaseUrl: process.env.PUBLIC_FILES_BASE_URL?.trim() || publicBaseUrl,
    publicObjectStore: {
      ...objectStore,
      bucketName: process.env.S3_PUBLIC_BUCKET?.trim() || "voidhash-public",
    },
    workos: {
      apiKey: requiredInProduction("WORKOS_API_KEY", "sk_test_selfhost_not_configured"),
      clientId: requiredInProduction("WORKOS_CLIENT_ID", "client_selfhost_not_configured"),
      cookieName: process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session",
      cookiePassword: requiredInProduction(
        "WORKOS_COOKIE_PASSWORD",
        "selfhost-development-cookie-password-change-me",
      ),
      webhookSecret: requiredInProduction("WORKOS_WEBHOOK_SECRET", "whsec_selfhost_not_configured"),
    },
  };
};
