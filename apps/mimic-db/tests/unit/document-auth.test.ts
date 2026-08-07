import { describe, expect, it, vi } from "vitest";

import { buildDocumentConnectionUrl } from "../../src/api/handlers/document-auth.ts";
import { getConfig } from "../../src/config.ts";

const PATH = "/ws/v1/databases/db-1/collections/col-1/documents/doc-1";

const relativeRequest = (headers: Record<string, string | undefined> = {}) => ({
  url: PATH,
  headers,
});

describe("buildDocumentConnectionUrl", () => {
  it("uses an https public base URL and yields wss", () => {
    const url = buildDocumentConnectionUrl(
      "https://mimic-db.example.workers.dev",
      relativeRequest({ "x-forwarded-proto": "http", host: "ignored.local" }),
      "db-1",
      "col-1",
      "doc-1",
    );
    expect(url).toBe(`wss://mimic-db.example.workers.dev${PATH}`);
  });

  it("uses an http public base URL and yields ws", () => {
    const url = buildDocumentConnectionUrl(
      "http://localhost:1338",
      relativeRequest(),
      "db-1",
      "col-1",
      "doc-1",
    );
    expect(url).toBe(`ws://localhost:1338${PATH}`);
  });

  it("falls back to x-forwarded headers when the base URL is unset", () => {
    const url = buildDocumentConnectionUrl(
      undefined,
      relativeRequest({
        "x-forwarded-proto": "https",
        "x-forwarded-host": "mimic.voidhash.com",
      }),
      "db-1",
      "col-1",
      "doc-1",
    );
    expect(url).toBe(`wss://mimic.voidhash.com${PATH}`);
  });

  it("falls back to the host header and ws when nothing else is present", () => {
    const url = buildDocumentConnectionUrl(
      undefined,
      relativeRequest({ host: "localhost:1338" }),
      "db-1",
      "col-1",
      "doc-1",
    );
    expect(url).toBe(`ws://localhost:1338${PATH}`);
  });

  it("derives scheme and host from an absolute request URL when the base URL is unset", () => {
    const url = buildDocumentConnectionUrl(
      undefined,
      { url: `https://mimic.voidhash.com${PATH}`, headers: {} },
      "db-1",
      "col-1",
      "doc-1",
    );
    expect(url).toBe(`wss://mimic.voidhash.com${PATH}`);
  });

  it("encodes path segments", () => {
    const url = buildDocumentConnectionUrl(
      "https://mimic-db.example.workers.dev",
      relativeRequest(),
      "db/1",
      "col 1",
      "doc#1",
    );
    expect(url).toBe(
      "wss://mimic-db.example.workers.dev/ws/v1/databases/db%2F1/collections/col%201/documents/doc%231",
    );
  });
});

describe("publicBaseUrl config", () => {
  // `vi.stubEnv` + `vi.unstubAllEnvs` replaces the save/restore `afterEach`:
  // each test restores the environment it stubbed before it returns.
  it("reads MIMIC_PUBLIC_BASE_URL when set", () => {
    vi.stubEnv("MIMIC_PUBLIC_BASE_URL", "https://mimic-db.example.workers.dev");
    expect(getConfig().publicBaseUrl).toBe("https://mimic-db.example.workers.dev");
    vi.unstubAllEnvs();
  });

  it("treats unset and blank values as undefined", () => {
    vi.stubEnv("MIMIC_PUBLIC_BASE_URL", undefined);
    expect(getConfig().publicBaseUrl).toBeUndefined();
    vi.stubEnv("MIMIC_PUBLIC_BASE_URL", "  ");
    expect(getConfig().publicBaseUrl).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
