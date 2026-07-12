import { ProjectSchemaCache } from "@voidhash/core/services";
import { Effect, Redacted } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MemoryProjectSchemaCacheLive } from "../src/backend/ProjectSchemaCache.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

beforeEach(() => {
  process.env.SELFHOST_MODE = "local-evaluation";
});

describe("self-host runtime configuration", () => {
  it("uses local development defaults", () => {
    delete process.env.NODE_ENV;
    delete process.env.CLICKHOUSE_URL;
    delete process.env.PUBLIC_BASE_URL;
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
    expect(config.publicBaseUrl).toBe("http://localhost:5001");
    expect(config.publicObjectStore.endpoint).toBe("http://127.0.0.1:9000");
    expect(config.mailer).toMatchObject({
      defaultFrom: { address: "noreply@voidhash.local", name: "Voidhash" },
      host: "127.0.0.1",
      port: 1025,
      verifyOnStart: false,
    });
    expect(config.workos.clientId).toBe("client_selfhost_not_configured");
  });

  it("reads authenticated TLS SMTP settings", () => {
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

  it("requires BYO WorkOS credentials in production", () => {
    process.env.NODE_ENV = "production";
    process.env.SELFHOST_MODE = "production";
    delete process.env.WORKOS_API_KEY;

    expect(() => getSelfhostRuntimeConfig()).toThrow("WORKOS_API_KEY");
  });

  it("supports an explicit plaintext connection for an internal Compose database", () => {
    process.env.DATABASE_HOST = "postgres";
    process.env.DATABASE_SSL = "false";

    expect(getSelfhostRuntimeConfig().database).toMatchObject({ host: "postgres", ssl: false });
  });

  it("enables ClickHouse only when its URL is configured", () => {
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
  it("stores, invalidates, and expires project schemas", async () => {
    await Effect.runPromise(
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
    );
  });
});
