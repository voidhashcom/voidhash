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

  it("treats any non-Sandbox value as production", () => {
    // The helper is a binary classifier: only the Sandbox value is "sandbox",
    // every other numeric code (including unknown ones) falls through to "production".
    expect(providerEnvironmentLabel(0)).toBe("production");
    expect(providerEnvironmentLabel(999)).toBe("production");
  });
});

describe("subscriptionStatusForInactiveEvent", () => {
  it("returns the Canceled subscription status", () => {
    expect(subscriptionStatusForInactiveEvent()).toBe(SubscriptionStatus.Canceled);
  });
});
