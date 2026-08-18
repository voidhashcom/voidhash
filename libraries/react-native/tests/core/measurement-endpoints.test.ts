import { describe, expect, it } from "vitest";

import { MeasurementConfigurationError, resolveMeasurementEndpoints } from "../../src/core/measurement";

describe("measurement endpoint overrides", () => {
  it("uses cloud origins when no override is supplied", () => {
    expect(resolveMeasurementEndpoints(undefined, false)).toEqual({
      api: "https://api.voidhash.com",
      ingest: "https://api.voidhash.com",
      links: "https://api.voidhash.com",
      trustedConfigKeyIds: [],
    });
  });

  it("accepts partial self-host overrides and exposes key IDs without key material", () => {
    const resolved = resolveMeasurementEndpoints(
      {
        ingest: "https://ingest.example.com",
        configurationProjectId: "project-1",
        trustedConfigKeys: [{ keyId: "rotation-2", publicKey: "secret-key-material" }],
      },
      false,
    );
    expect(resolved).toMatchObject({
      api: "https://api.voidhash.com",
      ingest: "https://ingest.example.com",
      links: "https://api.voidhash.com",
      trustedConfigKeyIds: ["rotation-2"],
    });
    expect(JSON.stringify(resolved)).not.toContain("secret-key-material");
  });

  it.each([
    "not-a-url",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?query=yes",
  ])("rejects unsafe endpoint %s", (api) => {
    expect(() => resolveMeasurementEndpoints({ api }, false)).toThrow(
      MeasurementConfigurationError,
    );
  });

  it("allows HTTP only under an explicit debug transport policy", () => {
    expect(() =>
      resolveMeasurementEndpoints({ api: "http://localhost:8787" }, true),
    ).toThrow(MeasurementConfigurationError);
    expect(
      resolveMeasurementEndpoints(
        { allowInsecureDebugTransport: true, api: "http://localhost:8787" },
        true,
      ).api,
    ).toBe("http://localhost:8787");
  });

  it("rejects duplicate trusted key IDs", () => {
    expect(() =>
      resolveMeasurementEndpoints(
        {
          configurationProjectId: "project-1",
          trustedConfigKeys: [
            { keyId: "same", publicKey: "a" },
            { keyId: "same", publicKey: "b" },
          ],
        },
        false,
      ),
    ).toThrow(MeasurementConfigurationError);
  });

  it("requires a project binding with trusted configuration keys", () => {
    expect(() =>
      resolveMeasurementEndpoints(
        { trustedConfigKeys: [{ keyId: "key-1", publicKey: "spki" }] },
        false,
      ),
    ).toThrow(MeasurementConfigurationError);
  });
});
