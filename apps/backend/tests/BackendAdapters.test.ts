import { ProjectSchemaCache } from "@voidhash/core/services";
import { Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { MemoryProjectSchemaCacheLive } from "../src/backend/ProjectSchemaCache.ts";
import { getSelfhostMigrationDatabaseConfig, getSelfhostRuntimeConfig } from "../src/config.ts";

const originalEnvironment = { ...process.env };

/**
 * Runs a configuration test against a pristine environment. The environment is
 * rebuilt before the body rather than restored by a lifecycle hook, so each case
 * is isolated from whatever the previous one set.
 */
const configTest = (name: string, body: () => void): void => {
  it(name, () => {
    process.env = { ...originalEnvironment, SELFHOST_MODE: "local-evaluation" };
    body();
    process.env = { ...originalEnvironment };
  });
};

describe("self-host runtime configuration", () => {
  configTest("uses local development defaults", () => {
    delete process.env.NODE_ENV;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLICKHOUSE_URL;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.S3_ENDPOINT;
    delete process.env.SMTP_FROM_ADDRESS;
    delete process.env.SMTP_FROM_NAME;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_REQUIRE_TLS;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
    delete process.env.SMTP_USERNAME;
    delete process.env.SMTP_VERIFY_ON_START;
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_COOKIE_PASSWORD;
    delete process.env.WORKOS_WEBHOOK_SECRET;

    const config = getSelfhostRuntimeConfig();

    expect(config.clickhouse).toBeUndefined();
    expect(config.agent).toMatchObject({
      modelId: "claude-sonnet-4-6",
      provider: "anthropic",
      visionModelId: "claude-sonnet-4-6",
      visionProvider: "anthropic",
    });
    expect(config.publicBaseUrl).toBe("http://localhost:5001");
    expect(config.publicObjectStore.endpoint).toBe("http://127.0.0.1:9000");
    expect(config.mailer).toMatchObject({
      defaultFrom: { address: "noreply@voidhash.local", name: "Voidhash" },
      host: "127.0.0.1",
      port: 1025,
      verifyOnStart: false,
    });
    expect(config.auth.rootUsername).toBe("root");
  });

  configTest("reads BYO agent provider and model settings", () => {
    process.env.OPENAI_API_KEY = "configured-openai-key";
    process.env.OPENAI_BASE_URL = "https://models.example.test/v1";
    process.env.VOIDHASH_AGENT_MODEL_PROVIDER = "openai";
    process.env.VOIDHASH_AGENT_MODEL_ID = "gpt-5.4";
    process.env.VOIDHASH_AGENT_VISION_MODEL_PROVIDER = "openai";
    process.env.VOIDHASH_AGENT_VISION_MODEL_ID = "gpt-5.4";

    const agent = getSelfhostRuntimeConfig().agent;

    expect(agent).toMatchObject({
      modelId: "gpt-5.4",
      openaiBaseUrl: "https://models.example.test/v1",
      provider: "openai",
      visionModelId: "gpt-5.4",
      visionProvider: "openai",
    });
    expect(Redacted.value(agent.openaiApiKey!)).toBe("configured-openai-key");
  });

  configTest("reads authenticated TLS SMTP settings", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_REQUIRE_TLS = "true";
    process.env.SMTP_USERNAME = "mailer";
    process.env.SMTP_PASSWORD = "secret";
    process.env.SMTP_FROM_ADDRESS = "notifications@example.com";
    process.env.SMTP_FROM_NAME = "Example";
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = "false";
    process.env.SMTP_VERIFY_ON_START = "true";

    const mailer = getSelfhostRuntimeConfig().mailer;

    expect(mailer).toMatchObject({
      defaultFrom: { address: "notifications@example.com", name: "Example" },
      host: "smtp.example.com",
      port: 465,
      requireTls: true,
      secure: true,
      tlsRejectUnauthorized: false,
      username: "mailer",
      verifyOnStart: true,
    });
    expect(Redacted.value(mailer.password!)).toBe("secret");
  });

  configTest("accepts real root credentials in production", () => {
    process.env.VOIDHASH_ROOT_USERNAME = "operator";
    process.env.VOIDHASH_ROOT_PASSWORD = "a-real-root-password";
    process.env.VOIDHASH_AUTH_SECRET = "a-real-session-signing-secret";

    const auth = getSelfhostRuntimeConfig().auth;

    expect(auth.rootUsername).toBe("operator");
    expect(auth.rootEmail).toBe("root@voidhash.local");
    expect(Redacted.value(auth.rootPassword)).toBe("a-real-root-password");
  });

  configTest("names every unconfigured standalone credential when production starts", () => {
    process.env.NODE_ENV = "production";
    process.env.SELFHOST_MODE = "production";
    delete process.env.VOIDHASH_ROOT_USERNAME;
    delete process.env.VOIDHASH_ROOT_PASSWORD;
    delete process.env.VOIDHASH_AUTH_SECRET;

    expect(() => getSelfhostRuntimeConfig()).toThrow(/VOIDHASH_ROOT_USERNAME/);
  });

  configTest("supports an explicit plaintext connection for an internal Compose database", () => {
    process.env.DATABASE_HOST = "postgres";
    process.env.DATABASE_SSL = "false";

    expect(getSelfhostRuntimeConfig().database).toMatchObject({ host: "postgres", ssl: false });
  });

  configTest("falls back to the application connection for migrations", () => {
    process.env.DATABASE_HOST = "postgres";
    process.env.DATABASE_PORT = "6543";
    process.env.DATABASE_NAME = "voidhash";
    process.env.DATABASE_USERNAME = "voidhash";
    process.env.DATABASE_PASSWORD = "application-secret";
    process.env.DATABASE_SSL = "false";
    delete process.env.DATABASE_DIRECT_HOST;

    expect(getSelfhostMigrationDatabaseConfig()).toEqual({
      databaseName: "voidhash",
      host: "postgres",
      password: "application-secret",
      port: 6543,
      ssl: false,
      username: "voidhash",
    });
  });

  configTest("overrides only the direct-TCP fields migrations need", () => {
    process.env.DATABASE_HOST = "broker.internal.local";
    process.env.DATABASE_PORT = "5432";
    process.env.DATABASE_NAME = "voidhash";
    process.env.DATABASE_USERNAME = "voidhash";
    process.env.DATABASE_PASSWORD = "application-secret";
    process.env.DATABASE_SSL = "false";
    process.env.DATABASE_DIRECT_HOST = "postgres";
    process.env.DATABASE_DIRECT_PORT = "6543";
    process.env.DATABASE_DIRECT_SSL = "true";

    expect(getSelfhostRuntimeConfig().database.host).toBe("broker.internal.local");
    expect(getSelfhostMigrationDatabaseConfig()).toEqual({
      databaseName: "voidhash",
      host: "postgres",
      password: "application-secret",
      port: 6543,
      ssl: true,
      username: "voidhash",
    });
  });

  configTest("enables ClickHouse only when its URL is configured", () => {
    process.env.CLICKHOUSE_URL = "http://clickhouse:8123";
    process.env.CLICKHOUSE_DATABASE = "analytics";
    delete process.env.CLICKHOUSE_ADMIN_USERNAME;
    delete process.env.CLICKHOUSE_ANALYTICS_QUERY_USERNAME;
    delete process.env.CLICKHOUSE_RO_USERNAME;
    delete process.env.CLICKHOUSE_USERNAME;

    expect(getSelfhostRuntimeConfig().clickhouse).toMatchObject({
      admin: { database: "analytics", username: "voidhash_admin" },
      analyticsQuery: { username: "voidhash_query" },
      readOnly: { username: "voidhash_ro" },
      readWrite: { username: "voidhash_app" },
    });
  });
});

describe("memory project schema cache", () => {
  it("stores, invalidates, and expires project schemas", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const cache = yield* ProjectSchemaCache;
        const project = cache.getByName("project-1");

        expect(yield* project.get()).toBeUndefined();
        yield* project.set({ version: 1 }, 10_000);
        expect(yield* project.get()).toEqual({ version: 1 });
        yield* project.invalidate();
        expect(yield* project.get()).toBeUndefined();

        yield* project.set({ version: 2 }, 0);
        expect(yield* project.get()).toBeUndefined();
      }).pipe(Effect.provide(MemoryProjectSchemaCacheLive)),
    ));
});
