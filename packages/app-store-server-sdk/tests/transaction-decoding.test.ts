import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { unwrapOptionsDeep } from "./util.ts";
import {
  AdvancedCommercePeriod,
  AdvancedCommercePriceIncreaseInfoStatus,
  AdvancedCommerceRefundReason,
  AdvancedCommerceRefundType,
  AutoRenewStatus,
  BillingPlanType,
  ConsumptionRequestReason,
  Environment,
  ExpirationIntent,
  InAppOwnershipType,
  JWSTransactionDecodedPayloadSchema,
  NotificationTypeV2,
  OfferDiscountType,
  OfferType,
  PriceIncreaseStatus,
  PurchasePlatform,
  RenewalBillingPlanType,
  RevocationReason,
  RevocationType,
  Status,
  Subtype,
  TransactionReason,
  Type,
} from "../src/schemas/index.ts";
import { Schema } from "effect";
import {
  createSignedDataFromJson,
  getDefaultSignedPayloadVerifier,
  getSignedPayloadVerifier,
} from "./util.ts";

describe("Testing decoding of signed data", () => {
  it("should decode an app transaction", () =>
    Effect.gen(function* () {
      const signedAppTransaction = createSignedDataFromJson(
        "tests/resources/models/appTransaction.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const appTransaction = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeAppTransaction(signedAppTransaction),
      );

      expect(appTransaction.receiptType).toBe(Environment.LOCAL_TESTING);
      expect(appTransaction.appAppleId).toBe(531412);
      expect(appTransaction.bundleId).toBe("com.example");
      expect(appTransaction.applicationVersion).toBe("1.2.3");
      expect(appTransaction.versionExternalIdentifier).toBe(512);
      expect(appTransaction.receiptCreationDate).toBe(1698148900000);
      expect(appTransaction.originalPurchaseDate).toBe(1698148800000);
      expect(appTransaction.originalApplicationVersion).toBe("1.1.2");
      expect(appTransaction.deviceVerification).toBe("device_verification_value");
      expect(appTransaction.deviceVerificationNonce).toBe("48ccfa42-7431-4f22-9908-7e88983e105a");
      expect(appTransaction.preorderDate).toBe(1698148700000);
      expect(appTransaction.appTransactionId).toBe("71134");
      expect(appTransaction.originalPlatform).toBe(PurchasePlatform.IOS);
    }).pipe(Effect.runPromise));

  it("should decode a renewal info", () =>
    Effect.gen(function* () {
      const signedRenewalInfo = createSignedDataFromJson(
        "tests/resources/models/signedRenewalInfo.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const renewalInfo = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo),
      );

      expect(renewalInfo.expirationIntent).toBe(ExpirationIntent.CUSTOMER_CANCELLED);
      expect(renewalInfo.originalTransactionId).toBe("12345");
      expect(renewalInfo.autoRenewProductId).toBe("com.example.product.2");
      expect(renewalInfo.productId).toBe("com.example.product");
      expect(renewalInfo.autoRenewStatus).toBe(AutoRenewStatus.ON);
      expect(renewalInfo.isInBillingRetryPeriod).toBe(true);
      expect(renewalInfo.priceIncreaseStatus).toBe(PriceIncreaseStatus.CUSTOMER_HAS_NOT_RESPONDED);
      expect(renewalInfo.gracePeriodExpiresDate).toBe(1698148900000);
      expect(renewalInfo.offerType).toBe(OfferType.PROMOTIONAL_OFFER);
      expect(renewalInfo.offerIdentifier).toBe("abc.123");
      expect(renewalInfo.signedDate).toBe(1698148800000);
      expect(renewalInfo.environment).toBe(Environment.LOCAL_TESTING);
      expect(renewalInfo.recentSubscriptionStartDate).toBe(1698148800000);
      expect(renewalInfo.renewalDate).toBe(1698148850000);
      expect(renewalInfo.renewalPrice).toBe(9990);
      expect(renewalInfo.currency).toBe("USD");
      expect(renewalInfo.offerDiscountType).toBe(OfferDiscountType.PAY_AS_YOU_GO);
      expect(renewalInfo.eligibleWinBackOfferIds).toEqual(["eligible1", "eligible2"]);
      expect(renewalInfo.appTransactionId).toBe("71134");
      expect(renewalInfo.offerPeriod).toBe("P1Y");
      expect(renewalInfo.appAccountToken).toBe("7e3fb20b-4cdb-47cc-936d-99d65f608138");

      // Advanced Commerce
      const ac = renewalInfo.advancedCommerceInfo;
      expect(ac).toBeDefined();
      expect(ac?.consistencyToken).toBe("token-abc-123");
      expect(ac?.descriptors?.description).toBe("Premium Plan");
      expect(ac?.descriptors?.displayName).toBe("Premium");
      expect(ac?.period).toBe(AdvancedCommercePeriod.P1M);
      expect(ac?.requestReferenceId).toBe("ref-12345");
      expect(ac?.taxCode).toBe("TAX_CODE_1");
      expect(ac?.items).toHaveLength(1);
      const renewalItem = ac?.items?.[0];
      expect(renewalItem?.SKU).toBe("com.example.sku.premium");
      expect(renewalItem?.description).toBe("Premium feature");
      expect(renewalItem?.displayName).toBe("Premium Feature");
      expect(renewalItem?.price).toBe(9990);
      expect(renewalItem?.priceIncreaseInfo?.dependentSKUs).toEqual([
        "com.example.sku.1",
        "com.example.sku.2",
      ]);
      expect(renewalItem?.priceIncreaseInfo?.price).toBe(12990);
      expect(renewalItem?.priceIncreaseInfo?.status).toBe(
        AdvancedCommercePriceIncreaseInfoStatus.PENDING,
      );

      // Commitment
      const commitment = renewalInfo.commitmentInfo;
      expect(commitment?.commitmentAutoRenewProductId).toBe("com.example.product.commitment");
      expect(commitment?.commitmentAutoRenewStatus).toBe(AutoRenewStatus.ON);
      expect(commitment?.commitmentRenewalBillingPlanType).toBe(RenewalBillingPlanType.MONTHLY);
      expect(commitment?.commitmentRenewalDate).toBe(1698149500000);
      expect(commitment?.commitmentRenewalPrice).toBe(9990);
      expect(renewalInfo.renewalBillingPlanType).toBe(RenewalBillingPlanType.MONTHLY);
    }).pipe(Effect.runPromise));

  it("should decode a transaction info", () =>
    Effect.gen(function* () {
      const signedTransaction = createSignedDataFromJson(
        "tests/resources/models/signedTransaction.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const transaction = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeTransaction(signedTransaction),
      );

      expect(transaction.originalTransactionId).toBe("12345");
      expect(transaction.transactionId).toBe("23456");
      expect(transaction.webOrderLineItemId).toBe("34343");
      expect(transaction.bundleId).toBe("com.example");
      expect(transaction.productId).toBe("com.example.product");
      expect(transaction.subscriptionGroupIdentifier).toBe("55555");
      expect(transaction.originalPurchaseDate).toBe(1698148800000);
      expect(transaction.purchaseDate).toBe(1698148900000);
      expect(transaction.revocationDate).toBe(1698148950000);
      expect(transaction.expiresDate).toBe(1698149000000);
      expect(transaction.quantity).toBe(1);
      expect(transaction.type).toBe(Type.AUTO_RENEWABLE_SUBSCRIPTION);
      expect(transaction.appAccountToken).toBe("7e3fb20b-4cdb-47cc-936d-99d65f608138");
      expect(transaction.inAppOwnershipType).toBe(InAppOwnershipType.PURCHASED);
      expect(transaction.signedDate).toBe(1698148900000);
      expect(transaction.revocationReason).toBe(RevocationReason.REFUNDED_DUE_TO_ISSUE);
      expect(transaction.offerIdentifier).toBe("abc.123");
      expect(transaction.isUpgraded).toBe(true);
      expect(transaction.offerType).toBe(OfferType.INTRODUCTORY_OFFER);
      expect(transaction.storefront).toBe("USA");
      expect(transaction.storefrontId).toBe("143441");
      expect(transaction.transactionReason).toBe(TransactionReason.PURCHASE);
      expect(transaction.environment).toBe(Environment.LOCAL_TESTING);
      expect(transaction.price).toBe(10990);
      expect(transaction.currency).toBe("USD");
      expect(transaction.offerDiscountType).toBe(OfferDiscountType.PAY_AS_YOU_GO);
      expect(transaction.appTransactionId).toBe("71134");
      expect(transaction.offerPeriod).toBe("P1Y");

      const info = transaction.advancedCommerceInfo;
      expect(info).toBeDefined();
      expect(info?.descriptors?.description).toBe("Premium Plan");
      expect(info?.descriptors?.displayName).toBe("Premium");
      expect(info?.estimatedTax).toBe(1500);
      expect(info?.period).toBe(AdvancedCommercePeriod.P1M);
      expect(info?.requestReferenceId).toBe("ref-12345");
      expect(info?.taxCode).toBe("TAX_CODE_1");
      expect(info?.taxExclusivePrice).toBe(8490);
      expect(info?.taxRate).toBe("0.15");
      expect(info?.items).toHaveLength(1);
      const item = info?.items?.[0];
      expect(item?.SKU).toBe("com.example.sku.premium");
      expect(item?.description).toBe("Premium feature");
      expect(item?.displayName).toBe("Premium Feature");
      expect(item?.price).toBe(9990);
      expect(item?.revocationDate).toBe(1698149200000);
      expect(item?.refunds).toHaveLength(1);
      const refund = item?.refunds?.[0];
      expect(refund?.refundAmount).toBe(5000);
      expect(refund?.refundDate).toBe(1698149100000);
      expect(refund?.refundReason).toBe(AdvancedCommerceRefundReason.FULFILLMENT_ISSUE);
      expect(refund?.refundType).toBe(AdvancedCommerceRefundType.PRORATED);
      expect(transaction.billingPlanType).toBe(BillingPlanType.MONTHLY);
      const txnCommitment = transaction.commitmentInfo;
      expect(txnCommitment?.billingPeriodNumber).toBe(3);
      expect(txnCommitment?.commitmentExpiresDate).toBe(1698150000000);
      expect(txnCommitment?.commitmentPrice).toBe(119880);
      expect(txnCommitment?.totalBillingPeriods).toBe(12);
    }).pipe(Effect.runPromise));

  it("should decode a transaction with revocation", () =>
    Effect.gen(function* () {
      const signedTransaction = createSignedDataFromJson(
        "tests/resources/models/signedTransactionWithRevocation.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const transaction = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeTransaction(signedTransaction),
      );

      expect(transaction.originalTransactionId).toBe("12345");
      expect(transaction.transactionId).toBe("23456");
      expect(transaction.revocationDate).toBe(1698148950000);
      expect(transaction.revocationReason).toBe(RevocationReason.REFUNDED_DUE_TO_ISSUE);
      expect(transaction.revocationType).toBe(RevocationType.REFUND_PRORATED);
      expect(transaction.revocationPercentage).toBe(50000);
    }).pipe(Effect.runPromise));

  it("should decode a signed notification", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedNotification.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(notification.notificationType).toBe(NotificationTypeV2.SUBSCRIBED);
      expect(notification.subtype).toBe(Subtype.INITIAL_BUY);
      expect(notification.notificationUUID).toBe("002e14d5-51f5-4503-b5a8-c3a1af68eb20");
      expect(notification.version).toBe("2.0");
      expect(notification.signedDate).toBe(1698148900000);
      expect(notification.data).toBeTruthy();
      expect(notification.summary).toBeFalsy();
      expect(notification.externalPurchaseToken).toBeFalsy();
      expect(notification.data?.environment).toBe(Environment.LOCAL_TESTING);
      expect(notification.data?.appAppleId).toBe(41234);
      expect(notification.data?.bundleId).toBe("com.example");
      expect(notification.data?.bundleVersion).toBe("1.2.3");
      expect(notification.data?.signedTransactionInfo).toBe("signed_transaction_info_value");
      expect(notification.data?.signedRenewalInfo).toBe("signed_renewal_info_value");
      expect(notification.data?.status).toBe(Status.ACTIVE);
      expect(notification.data?.consumptionRequestReason).toBeFalsy();
    }).pipe(Effect.runPromise));

  it("should decode a signed CONSUMPTION_REQUEST notification", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedConsumptionRequestNotification.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(notification.notificationType).toBe(NotificationTypeV2.CONSUMPTION_REQUEST);
      expect(notification.subtype).toBeFalsy();
      expect(notification.data).toBeTruthy();
      expect(notification.data?.consumptionRequestReason).toBe(
        ConsumptionRequestReason.UNINTENDED_PURCHASE,
      );
    }).pipe(Effect.runPromise));

  it("should decode a signed summary notification", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedSummaryNotification.json",
      );
      const verifier = getDefaultSignedPayloadVerifier();

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(notification.notificationType).toBe(NotificationTypeV2.RENEWAL_EXTENSION);
      expect(notification.subtype).toBe(Subtype.SUMMARY);
      expect(notification.data).toBeFalsy();
      expect(notification.summary).toBeTruthy();
      expect(notification.summary?.environment).toBe(Environment.LOCAL_TESTING);
      expect(notification.summary?.appAppleId).toBe(41234);
      expect(notification.summary?.bundleId).toBe("com.example");
      expect(notification.summary?.productId).toBe("com.example.product");
      expect(notification.summary?.requestIdentifier).toBe("efb27071-45a4-4aca-9854-2a1e9146f265");
      expect(notification.summary?.storefrontCountryCodes).toEqual(["CAN", "USA", "MEX"]);
      expect(notification.summary?.succeededCount).toBe(5);
      expect(notification.summary?.failedCount).toBe(2);
    }).pipe(Effect.runPromise));

  it("should decode a signed external purchase token notification", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedExternalPurchaseTokenNotification.json",
      );

      let observedBundleId: string | undefined;
      let observedAppAppleId: number | undefined;
      let observedEnvironment: string | undefined;
      const verifier = getSignedPayloadVerifier(
        // Use LOCAL_TESTING to skip cert/signature checks; the override receives
        // the values extracted from the (Production) fixture payload.
        Environment.LOCAL_TESTING,
        "com.example",
        55555,
        (bundleId, appAppleId, environment) => {
          observedBundleId = bundleId;
          observedAppAppleId = appAppleId;
          observedEnvironment = environment;
        },
      );

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(observedBundleId).toBe("com.example");
      expect(observedAppAppleId).toBe(55555);
      expect(observedEnvironment).toBe(Environment.PRODUCTION);
      expect(notification.notificationType).toBe(NotificationTypeV2.EXTERNAL_PURCHASE_TOKEN);
      expect(notification.subtype).toBe(Subtype.UNREPORTED);
      expect(notification.externalPurchaseToken?.externalPurchaseId).toBe(
        "b2158121-7af9-49d4-9561-1f588205523e",
      );
      expect(notification.externalPurchaseToken?.tokenCreationDate).toBe(1698148950000);
      expect(notification.externalPurchaseToken?.appAppleId).toBe(55555);
      expect(notification.externalPurchaseToken?.bundleId).toBe("com.example");
    }).pipe(Effect.runPromise));

  it("should detect sandbox env from external purchase token externalPurchaseId prefix", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedExternalPurchaseTokenSandboxNotification.json",
      );

      let observedEnvironment: string | undefined;
      const verifier = getSignedPayloadVerifier(
        Environment.LOCAL_TESTING,
        "com.example",
        55555,
        (_bundleId, _appAppleId, environment) => {
          observedEnvironment = environment;
        },
      );

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(observedEnvironment).toBe(Environment.SANDBOX);
      expect(notification.externalPurchaseToken?.externalPurchaseId).toBe(
        "SANDBOX_b2158121-7af9-49d4-9561-1f588205523e",
      );
    }).pipe(Effect.runPromise));

  it("should decode a signed RESCIND_CONSENT notification", () =>
    Effect.gen(function* () {
      const signedNotification = createSignedDataFromJson(
        "tests/resources/models/signedRescindConsentNotification.json",
      );

      let observedBundleId: string | undefined;
      let observedAppAppleId: number | undefined;
      let observedEnvironment: string | undefined;
      const verifier = getSignedPayloadVerifier(
        Environment.LOCAL_TESTING,
        "com.example",
        41234,
        (bundleId, appAppleId, environment) => {
          observedBundleId = bundleId;
          observedAppAppleId = appAppleId;
          observedEnvironment = environment;
        },
      );

      const notification = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(signedNotification),
      );

      expect(observedBundleId).toBe("com.example");
      expect(observedAppAppleId).toBe(41234);
      expect(observedEnvironment).toBe(Environment.LOCAL_TESTING);
      expect(notification.notificationType).toBe(NotificationTypeV2.RESCIND_CONSENT);
      expect(notification.appData?.environment).toBe(Environment.LOCAL_TESTING);
      expect(notification.appData?.appAppleId).toBe(41234);
      expect(notification.appData?.bundleId).toBe("com.example");
      expect(notification.appData?.signedAppTransactionInfo).toBe(
        "signed_app_transaction_info_value",
      );
    }).pipe(Effect.runPromise));

  it("should accept revocationType as a string in transaction payloads", () => {
    const transaction = unwrapOptionsDeep(
      Schema.decodeUnknownSync(JWSTransactionDecodedPayloadSchema)({
        originalTransactionId: "12345",
        transactionId: "23456",
        bundleId: "com.example",
        productId: "com.example.product",
        revocationType: "REFUND_FULL",
      }),
    );

    expect(transaction.revocationType).toBe("REFUND_FULL");
  });
});
