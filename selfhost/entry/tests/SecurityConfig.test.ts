import { afterEach, describe, expect, it, vi } from "vitest";

import { validateSelfhostSecurityConfig } from "../src/config.ts";

const validProductionEnvironment = {
  CLICKHOUSE_URL: "",
  DATABASE_PASSWORD: "database-secret",
  MIMIC_PUBLIC_BASE_URL: "https://mimic.example.test",
  MIMIC_ROOT_PASSWORD: "mimic-secret",
  PUBLIC_BASE_URL: "https://app.example.test",
  PUBLIC_FILES_BASE_URL: "https://files.example.test",
  S3_SECRET_ACCESS_KEY: "object-store-secret",
  SELFHOST_MODE: "production",
  WORKOS_API_KEY: "configured-workos-key",
  WORKOS_CLIENT_ID: "client_configured",
  WORKOS_COOKIE_PASSWORD: "cookie-secret-with-sufficient-entropy",
  WORKOS_REDIRECT_URI: "https://app.example.test/api/auth/callback",
  WORKOS_WEBHOOK_SECRET: "whsec_configured",
} as const;

const stubEnvironment = (environment: Record<string, string>) => {
  for (const [name, value] of Object.entries(environment)) {
    vi.stubEnv(name, value);
  }
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateSelfhostSecurityConfig", () => {
  it("requires operators to select a mode explicitly", () => {
    vi.stubEnv("SELFHOST_MODE", "");
    expect(() => validateSelfhostSecurityConfig()).toThrow(/SELFHOST_MODE/);
  });

  it("allows the documented local evaluation defaults only in evaluation mode", () => {
    vi.stubEnv("SELFHOST_MODE", "local-evaluation");
    expect(validateSelfhostSecurityConfig()).toBe("local-evaluation");
  });

  it("treats local evaluation as authoritative when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SELFHOST_MODE", "local-evaluation");
    expect(validateSelfhostSecurityConfig()).toBe("local-evaluation");
  });

  it("accepts non-example credentials and HTTPS URLs in production mode", () => {
    stubEnvironment(validProductionEnvironment);
    expect(validateSelfhostSecurityConfig()).toBe("production");
  });

  it.each([
    "DATABASE_PASSWORD",
    "MIMIC_ROOT_PASSWORD",
    "S3_SECRET_ACCESS_KEY",
    "WORKOS_API_KEY",
    "WORKOS_CLIENT_ID",
    "WORKOS_COOKIE_PASSWORD",
    "WORKOS_WEBHOOK_SECRET",
  ])("rejects an absent or example %s in production mode", (name) => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv(name, "password");
    expect(() => validateSelfhostSecurityConfig()).toThrow(name);
  });

  it("rejects the local-evaluation cookie placeholder in production mode", () => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv("WORKOS_COOKIE_PASSWORD", "selfhost-development-cookie-password-change-me");
    expect(() => validateSelfhostSecurityConfig()).toThrow("WORKOS_COOKIE_PASSWORD");
  });

  it("requires every enabled ClickHouse role to have a non-example password", () => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv("CLICKHOUSE_URL", "http://clickhouse:8123");
    vi.stubEnv("CLICKHOUSE_ADMIN_PASSWORD", "configured");
    vi.stubEnv("CLICKHOUSE_PASSWORD", "configured");
    vi.stubEnv("CLICKHOUSE_RO_PASSWORD", "configured");
    vi.stubEnv("CLICKHOUSE_ANALYTICS_QUERY_PASSWORD", "password");
    expect(() => validateSelfhostSecurityConfig()).toThrow("CLICKHOUSE_ANALYTICS_QUERY_PASSWORD");
  });

  it.each([
    "PUBLIC_BASE_URL",
    "PUBLIC_FILES_BASE_URL",
    "MIMIC_PUBLIC_BASE_URL",
    "WORKOS_REDIRECT_URI",
  ])("rejects a non-HTTPS %s in production mode", (name) => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv(name, "http://localhost:5001");
    expect(() => validateSelfhostSecurityConfig()).toThrow(name);
  });
});
