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
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
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

/** Configuration for the single-process self-host runtime. */
export interface SelfhostRuntimeConfig {
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
    tlsRejectUnauthorized:
      optionalBooleanFromEnv("SMTP_TLS_REJECT_UNAUTHORIZED") ?? true,
    verifyOnStart: optionalBooleanFromEnv("SMTP_VERIFY_ON_START") ?? false,
    ...(username === undefined ? {} : { username }),
    ...(password === undefined ? {} : { password: Redacted.make(password) }),
  };
};

/** Reads and validates the complete single-process runtime configuration. */
export const getSelfhostRuntimeConfig = (): SelfhostRuntimeConfig => {
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

  return {
    artifactObjectStore: {
      ...objectStore,
      bucketName: process.env.S3_ARTIFACT_BUCKET?.trim() || "voidhash-artifacts",
    },
    database: getSelfhostDatabaseConfig(),
    ...(clickhouse === undefined ? {} : { clickhouse }),
    componentCompilerUrl:
      process.env.COMPONENT_COMPILER_URL?.trim() || "http://127.0.0.1:5002",
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
      webhookSecret: requiredInProduction(
        "WORKOS_WEBHOOK_SECRET",
        "whsec_selfhost_not_configured",
      ),
    },
  };
};
