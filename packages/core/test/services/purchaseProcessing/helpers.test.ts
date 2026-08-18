import { describe, expect, it } from "vite-plus/test";

import { SubscriptionStatus } from "@voidhash/lib";

import { ProviderEnvironment } from "@voidhash/db";

import {
  providerEnvironmentLabel,
  subscriptionStatusForInactiveEvent,
} from "../../../src/services/purchaseProcessing/helpers.ts";

describe("providerEnvironmentLabel", () => {
  it("maps the Sandbox environment to 'sandbox'", () => {
    expect(providerEnvironmentLabel(ProviderEnvironment.Sandbox)).toBe("sandbox");
  });

  it("maps the Production environment to 'production'", () => {
    expect(providerEnvironmentLabel(ProviderEnvironment.Production)).toBe("production");
  });

  it("maps the Development environment to 'development'", () => {
    expect(providerEnvironmentLabel(ProviderEnvironment.Development)).toBe("development");
  });

  it("treats unknown values as production", () => {
    expect(providerEnvironmentLabel(0)).toBe("production");
    expect(providerEnvironmentLabel(999)).toBe("production");
  });
});

describe("subscriptionStatusForInactiveEvent", () => {
  it("returns the Canceled subscription status", () => {
    expect(subscriptionStatusForInactiveEvent()).toBe(SubscriptionStatus.Canceled);
  });
});
