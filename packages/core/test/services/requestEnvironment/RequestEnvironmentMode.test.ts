import { ProviderEnvironment } from "@voidhash/db";
import { describe, expect, it } from "vite-plus/test";

import { resolveRequestEnvironmentMode } from "../../../src/services/requestEnvironment/RequestEnvironmentMode.ts";

describe("resolveRequestEnvironmentMode", () => {
  it("defaults missing and unknown values to the real-provider universe", () => {
    expect(resolveRequestEnvironmentMode(undefined)).toEqual({
      name: "production",
      providerEnvironments: [ProviderEnvironment.Production, ProviderEnvironment.Sandbox],
    });
    expect(resolveRequestEnvironmentMode("unknown")).toEqual(
      resolveRequestEnvironmentMode(undefined),
    );
  });

  it("isolates development data", () => {
    expect(resolveRequestEnvironmentMode("development")).toEqual({
      name: "development",
      providerEnvironments: [ProviderEnvironment.Development],
    });
  });

  it("unions production, store sandbox, and development data", () => {
    expect(resolveRequestEnvironmentMode("all")).toEqual({
      name: "all",
      providerEnvironments: [
        ProviderEnvironment.Production,
        ProviderEnvironment.Sandbox,
        ProviderEnvironment.Development,
      ],
    });
  });
});
