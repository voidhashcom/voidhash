import { describe, expect, it } from "vite-plus/test";

import { mapSdkTransactionSubmission } from "./sdk.ts";

describe("SDK transaction route mapping", () => {
  it("forwards the Android native product id as the Google Play product hint", () => {
    expect(
      mapSdkTransactionSubmission(
        {
          platform: "android",
          providerProductId: "com.voidhash.yearly.android",
          productSlug: "yearly_sub",
          purchaseToken: "purchase-token",
          transactionId: "order-id",
        },
        "com.voidhash.test",
      ),
    ).toEqual({
      packageName: "com.voidhash.test",
      productId: "com.voidhash.yearly.android",
      providerId: "google-play",
      purchaseToken: "purchase-token",
    });
  });

  it("falls back to the product slug for older Android SDK payloads", () => {
    expect(
      mapSdkTransactionSubmission(
        {
          platform: "android",
          productSlug: "legacy-play-product-id",
          purchaseToken: "purchase-token",
          transactionId: "order-id",
        },
        "com.voidhash.test",
      ),
    ).toMatchObject({ productId: "legacy-play-product-id" });
  });

  it("maps iOS to the App Store transaction and bundle identifiers", () => {
    expect(
      mapSdkTransactionSubmission(
        {
          platform: "ios",
          productSlug: "monthly_sub",
          transactionId: "transaction-id",
        },
        "com.voidhash.test",
      ),
    ).toEqual({
      bundleId: "com.voidhash.test",
      providerId: "apple-app-store",
      transactionId: "transaction-id",
    });
  });
});
