import { constant } from "@voidhash/lib/lang";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateSelfhostSecurityConfig } from "../src/config.ts";

const validProductionEnvironment = constant({
  CLICKHOUSE_URL: "",
  DATABASE_PASSWORD: "database-secret",
  MIMIC_PUBLIC_BASE_URL: "https://mimic.example.test",
  MIMIC_ROOT_PASSWORD: "mimic-secret",
  OPENAI_API_KEY: "configured-openai-key",
  PUBLIC_BASE_URL: "https://app.example.test",
  PUBLIC_FILES_BASE_URL: "https://files.example.test",
  S3_SECRET_ACCESS_KEY: "object-store-secret",
  SELFHOST_MODE: "production",
  VOIDHASH_AUTH_SECRET: "session-signing-secret-with-entropy",
  VOIDHASH_ROOT_PASSWORD: "root-secret-with-sufficient-entropy",
  VOIDHASH_ROOT_USERNAME: "operator",
});

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
    "VOIDHASH_ROOT_PASSWORD",
    "VOIDHASH_AUTH_SECRET",
  ])("rejects an absent or example %s in production mode", (name) => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv(name, "password");
    expect(() => validateSelfhostSecurityConfig()).toThrow(name);
  });

  it("rejects an unset root username in production mode", () => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv("VOIDHASH_ROOT_USERNAME", "");
    expect(() => validateSelfhostSecurityConfig()).toThrow("VOIDHASH_ROOT_USERNAME");
  });

  it("rejects a placeholder root password in production mode", () => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv("VOIDHASH_ROOT_PASSWORD", "replace-with-a-random-password");
    expect(() => validateSelfhostSecurityConfig()).toThrow("VOIDHASH_ROOT_PASSWORD");
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
  ])("rejects a non-HTTPS %s in production mode", (name) => {
    stubEnvironment(validProductionEnvironment);
    vi.stubEnv(name, "http://localhost:5001");
    expect(() => validateSelfhostSecurityConfig()).toThrow(name);
  });
});
