import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { unwrapOptionsDeep } from "./util.ts";
import {
  AdvancedCommerceDescriptorsSchema,
  AdvancedCommerceEffective,
  AdvancedCommerceOfferPeriod,
  AdvancedCommerceOfferReason,
  AdvancedCommerceOfferSchema,
  AdvancedCommerceOneTimeChargeCreateRequestSchema,
  AdvancedCommerceOneTimeChargeItemSchema,
  AdvancedCommercePeriod,
  AdvancedCommercePriceIncreaseInfoStatus,
  AdvancedCommerceReason,
  AdvancedCommerceRequestInfoSchema,
  AdvancedCommerceRequestRefundItemSchema,
  AdvancedCommerceRequestRefundRequestSchema,
  AdvancedCommerceRequestRefundResponseSchema,
  AdvancedCommerceRefundReason,
  AdvancedCommerceRefundType,
  AdvancedCommerceSubscriptionCancelRequestSchema,
  AdvancedCommerceSubscriptionCancelResponseSchema,
  AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema,
  AdvancedCommerceSubscriptionChangeMetadataItemSchema,
  AdvancedCommerceSubscriptionChangeMetadataRequestSchema,
  AdvancedCommerceSubscriptionChangeMetadataResponseSchema,
  AdvancedCommerceSubscriptionCreateItemSchema,
  AdvancedCommerceSubscriptionCreateRequestSchema,
  AdvancedCommerceSubscriptionMigrateDescriptorsSchema,
  AdvancedCommerceSubscriptionMigrateItemSchema,
  AdvancedCommerceSubscriptionMigrateRenewalItemSchema,
  AdvancedCommerceSubscriptionMigrateRequestSchema,
  AdvancedCommerceSubscriptionMigrateResponseSchema,
  AdvancedCommerceSubscriptionModifyAddItemSchema,
  AdvancedCommerceSubscriptionModifyChangeItemSchema,
  AdvancedCommerceSubscriptionModifyDescriptorsSchema,
  AdvancedCommerceSubscriptionModifyInAppRequestSchema,
  AdvancedCommerceSubscriptionModifyPeriodChangeSchema,
  AdvancedCommerceSubscriptionModifyRemoveItemSchema,
  AdvancedCommerceSubscriptionPriceChangeItemSchema,
  AdvancedCommerceSubscriptionPriceChangeRequestSchema,
  AdvancedCommerceSubscriptionPriceChangeResponseSchema,
  AdvancedCommerceSubscriptionReactivateInAppRequestSchema,
  AdvancedCommerceSubscriptionReactivateItemSchema,
  AdvancedCommerceSubscriptionRevokeRequestSchema,
  AdvancedCommerceSubscriptionRevokeResponseSchema,
  BillingPlanType,
  HelperValidationUtils,
  RenewalBillingPlanType,
} from "../src/schemas/index.ts";
import { readFile } from "./util.ts";

const decode = <S extends Schema.Top>(schema: S, path: string): S["Type"] =>
  unwrapOptionsDeep(Schema.decodeUnknownSync(schema)(JSON.parse(readFile(path))));

describe("AdvancedCommerce enums", () => {
  it("exposes AdvancedCommercePeriod values", () => {
    expect(AdvancedCommercePeriod.P1W).toBe("P1W");
    expect(AdvancedCommercePeriod.P1M).toBe("P1M");
    expect(AdvancedCommercePeriod.P2M).toBe("P2M");
    expect(AdvancedCommercePeriod.P3M).toBe("P3M");
    expect(AdvancedCommercePeriod.P6M).toBe("P6M");
    expect(AdvancedCommercePeriod.P1Y).toBe("P1Y");
  });

  it("exposes AdvancedCommerceReason values", () => {
    expect(AdvancedCommerceReason.UPGRADE).toBe("UPGRADE");
    expect(AdvancedCommerceReason.DOWNGRADE).toBe("DOWNGRADE");
    expect(AdvancedCommerceReason.APPLY_OFFER).toBe("APPLY_OFFER");
  });

  it("exposes AdvancedCommerceRefundReason values", () => {
    expect(AdvancedCommerceRefundReason.UNINTENDED_PURCHASE).toBe("UNINTENDED_PURCHASE");
    expect(AdvancedCommerceRefundReason.FULFILLMENT_ISSUE).toBe("FULFILLMENT_ISSUE");
    expect(AdvancedCommerceRefundReason.UNSATISFIED_WITH_PURCHASE).toBe(
      "UNSATISFIED_WITH_PURCHASE",
    );
    expect(AdvancedCommerceRefundReason.LEGAL).toBe("LEGAL");
    expect(AdvancedCommerceRefundReason.OTHER).toBe("OTHER");
    expect(AdvancedCommerceRefundReason.MODIFY_ITEMS_REFUND).toBe("MODIFY_ITEMS_REFUND");
    expect(AdvancedCommerceRefundReason.SIMULATE_REFUND_DECLINE).toBe("SIMULATE_REFUND_DECLINE");
  });

  it("exposes AdvancedCommerceRefundType values", () => {
    expect(AdvancedCommerceRefundType.FULL).toBe("FULL");
    expect(AdvancedCommerceRefundType.PRORATED).toBe("PRORATED");
    expect(AdvancedCommerceRefundType.CUSTOM).toBe("CUSTOM");
  });

  it("exposes AdvancedCommerceOfferPeriod values", () => {
    expect(AdvancedCommerceOfferPeriod.P3D).toBe("P3D");
    expect(AdvancedCommerceOfferPeriod.P1W).toBe("P1W");
    expect(AdvancedCommerceOfferPeriod.P2W).toBe("P2W");
    expect(AdvancedCommerceOfferPeriod.P1M).toBe("P1M");
    expect(AdvancedCommerceOfferPeriod.P2M).toBe("P2M");
    expect(AdvancedCommerceOfferPeriod.P3M).toBe("P3M");
  });

  it("exposes AdvancedCommerceOfferReason values", () => {
    expect(AdvancedCommerceOfferReason.ACQUISITION).toBe("ACQUISITION");
    expect(AdvancedCommerceOfferReason.WIN_BACK).toBe("WIN_BACK");
    expect(AdvancedCommerceOfferReason.RETENTION).toBe("RETENTION");
  });

  it("exposes AdvancedCommerceEffective values", () => {
    expect(AdvancedCommerceEffective.IMMEDIATELY).toBe("IMMEDIATELY");
    expect(AdvancedCommerceEffective.NEXT_BILL_CYCLE).toBe("NEXT_BILL_CYCLE");
  });

  it("exposes AdvancedCommercePriceIncreaseInfoStatus values", () => {
    expect(AdvancedCommercePriceIncreaseInfoStatus.SCHEDULED).toBe("SCHEDULED");
    expect(AdvancedCommercePriceIncreaseInfoStatus.PENDING).toBe("PENDING");
    expect(AdvancedCommercePriceIncreaseInfoStatus.ACCEPTED).toBe("ACCEPTED");
  });

  it("exposes BillingPlanType / RenewalBillingPlanType values", () => {
    expect(BillingPlanType.BILLED_UPFRONT).toBe("BILLED_UPFRONT");
    expect(BillingPlanType.MONTHLY).toBe("MONTHLY");
    expect(RenewalBillingPlanType.BILLED_UPFRONT).toBe("BILLED_UPFRONT");
    expect(RenewalBillingPlanType.MONTHLY).toBe("MONTHLY");
  });
});

describe("HelperValidationUtils", () => {
  it("validates description constraints", () => {
    expect(HelperValidationUtils.validateDescription("Valid description")).toBe(true);
    expect(HelperValidationUtils.validateDescription("A".repeat(45))).toBe(true);
    expect(HelperValidationUtils.validateDescription("A".repeat(46))).toBe(false);
    expect(HelperValidationUtils.validateDescription(null)).toBe(false);
  });

  it("validates displayName constraints", () => {
    expect(HelperValidationUtils.validateDisplayName("Valid Name")).toBe(true);
    expect(HelperValidationUtils.validateDisplayName("A".repeat(30))).toBe(true);
    expect(HelperValidationUtils.validateDisplayName("A".repeat(31))).toBe(false);
    expect(HelperValidationUtils.validateDisplayName(null)).toBe(false);
  });

  it("validates SKU constraints", () => {
    expect(HelperValidationUtils.validateSku("valid.sku.123")).toBe(true);
    expect(HelperValidationUtils.validateSku("A".repeat(128))).toBe(true);
    expect(HelperValidationUtils.validateSku("A".repeat(129))).toBe(false);
    expect(HelperValidationUtils.validateSku(null)).toBe(false);
  });

  it("validates periodCount constraints", () => {
    expect(HelperValidationUtils.validatePeriodCount(1)).toBe(true);
    expect(HelperValidationUtils.validatePeriodCount(6)).toBe(true);
    expect(HelperValidationUtils.validatePeriodCount(12)).toBe(true);
    expect(HelperValidationUtils.validatePeriodCount(0)).toBe(false);
    expect(HelperValidationUtils.validatePeriodCount(13)).toBe(false);
    expect(HelperValidationUtils.validatePeriodCount(null)).toBe(false);
  });

  it("validates non-empty items array", () => {
    expect(HelperValidationUtils.validateItems([{ SKU: "sku1" }])).toBe(true);
    expect(HelperValidationUtils.validateItems(null)).toBe(false);
    expect(HelperValidationUtils.validateItems([])).toBe(false);
    expect(HelperValidationUtils.validateItems([null])).toBe(false);
  });
});

describe("AdvancedCommerce JSON model decoding", () => {
  it("decodes AdvancedCommerceDescriptors", () => {
    const descriptors = decode(
      AdvancedCommerceDescriptorsSchema,
      "tests/resources/models/advancedCommerceDescriptors.json",
    );
    expect(descriptors.description).toBe("description");
    expect(descriptors.displayName).toBe("display name");
  });

  it("decodes AdvancedCommerceOneTimeChargeItem", () => {
    const item = decode(
      AdvancedCommerceOneTimeChargeItemSchema,
      "tests/resources/models/advancedCommerceOneTimeChargeItem.json",
    );
    expect(item.description).toBe("description");
    expect(item.displayName).toBe("display name");
    expect(item.SKU).toBe("sku");
    expect(item.price).toBe(15000);
  });

  it("decodes AdvancedCommerceSubscriptionCreateItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionCreateItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionCreateItem.json",
    );
    expect(item.description).toBe("description");
    expect(item.displayName).toBe("display name");
    expect(item.SKU).toBe("sku");
    expect(item.price).toBe(20000);
  });

  it("decodes AdvancedCommerceRequestRefundItem", () => {
    const item = decode(
      AdvancedCommerceRequestRefundItemSchema,
      "tests/resources/models/advancedCommerceRequestRefundItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.refundReason).toBe(AdvancedCommerceRefundReason.LEGAL);
    expect(item.refundType).toBe(AdvancedCommerceRefundType.FULL);
    expect(item.revoke).toBe(true);
    expect(item.refundAmount).toBe(5000);
  });

  it("decodes AdvancedCommerceOffer", () => {
    const offer = decode(
      AdvancedCommerceOfferSchema,
      "tests/resources/models/advancedCommerceOffer.json",
    );
    expect(offer.period).toBe(AdvancedCommerceOfferPeriod.P1W);
    expect(offer.periodCount).toBe(3);
    expect(offer.price).toBe(5000);
    expect(offer.reason).toBe(AdvancedCommerceOfferReason.WIN_BACK);
  });

  it("decodes AdvancedCommerceOneTimeChargeCreateRequest", () => {
    const request = decode(
      AdvancedCommerceOneTimeChargeCreateRequestSchema,
      "tests/resources/models/advancedCommerceOneTimeChargeCreateRequest.json",
    );
    expect(request.currency).toBe("USD");
    expect(request.item).toBeTruthy();
    expect(request.taxCode).toBe("taxCode");
    expect(request.requestInfo).toBeTruthy();
    expect(request.storefront).toBe("USA");
  });

  it("decodes AdvancedCommerceSubscriptionCreateRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionCreateRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionCreateRequest.json",
    );
    expect(request.currency).toBe("USD");
    expect(request.descriptors).toBeTruthy();
    expect(request.items).toHaveLength(2);
    expect(request.period).toBe(AdvancedCommercePeriod.P1M);
    expect(request.taxCode).toBe("taxCode");
    expect(request.storefront).toBe("USA");
    expect(request.previousTransactionId).toBe("transactionId");
  });

  it("decodes AdvancedCommerceRequestRefundRequest", () => {
    const request = decode(
      AdvancedCommerceRequestRefundRequestSchema,
      "tests/resources/models/advancedCommerceRequestRefundRequest.json",
    );
    expect(request.items).toHaveLength(2);
    expect(request.refundRiskingPreference).toBe(true);
    expect(request.requestInfo).toBeTruthy();
    expect(request.currency).toBe("USD");
    expect(request.storefront).toBe("USA");
  });

  it("decodes AdvancedCommerceSubscriptionCancelRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionCancelRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionCancelRequest.json",
    );
    expect(request.requestInfo).toBeTruthy();
    expect(request.storefront).toBe("USA");
  });

  it("decodes AdvancedCommerceSubscriptionRevokeRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionRevokeRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionRevokeRequest.json",
    );
    expect(request.requestInfo).toBeTruthy();
    expect(request.refundRiskingPreference).toBe(true);
    expect(request.refundReason).toBe(AdvancedCommerceRefundReason.LEGAL);
    expect(request.refundType).toBe(AdvancedCommerceRefundType.FULL);
    expect(request.storefront).toBe("USA");
  });

  it("decodes AdvancedCommerceSubscriptionPriceChangeRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionPriceChangeRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionPriceChangeRequest.json",
    );
    expect(request.items).toBeTruthy();
    expect(request.requestInfo).toBeTruthy();
    expect(request.currency).toBe("USD");
  });

  it("decodes AdvancedCommerceRequestRefundResponse", () => {
    const response = decode(
      AdvancedCommerceRequestRefundResponseSchema,
      "tests/resources/models/advancedCommerceRequestRefundResponse.json",
    );
    expect(response.signedRenewalInfo).toBeFalsy();
    expect(response.signedTransactionInfo).toBe("signed_transaction_info_value");
  });

  it("decodes AdvancedCommerceSubscriptionCancelResponse", () => {
    const response = decode(
      AdvancedCommerceSubscriptionCancelResponseSchema,
      "tests/resources/models/advancedCommerceSubscriptionCancelResponse.json",
    );
    expect(response.signedRenewalInfo).toBe("signed_renewal_info");
    expect(response.signedTransactionInfo).toBe("signed_transaction_info");
  });

  it("decodes AdvancedCommerceSubscriptionRevokeResponse", () => {
    const response = decode(
      AdvancedCommerceSubscriptionRevokeResponseSchema,
      "tests/resources/models/advancedCommerceSubscriptionRevokeResponse.json",
    );
    expect(response.signedRenewalInfo).toBe("signed_renewal_info");
    expect(response.signedTransactionInfo).toBe("signed_transaction_info");
  });

  it("decodes AdvancedCommerceSubscriptionPriceChangeResponse", () => {
    const response = decode(
      AdvancedCommerceSubscriptionPriceChangeResponseSchema,
      "tests/resources/models/advancedCommerceSubscriptionPriceChangeResponse.json",
    );
    expect(response.signedRenewalInfo).toBe("signed_renewal_info");
    expect(response.signedTransactionInfo).toBe("signed_transaction_info");
  });

  it("decodes AdvancedCommerceSubscriptionChangeMetadataResponse", () => {
    const response = decode(
      AdvancedCommerceSubscriptionChangeMetadataResponseSchema,
      "tests/resources/models/advancedCommerceSubscriptionChangeMetadataResponse.json",
    );
    expect(response.signedRenewalInfo).toBe("signed_renewal_info");
    expect(response.signedTransactionInfo).toBe("signed_transaction_info");
  });

  it("decodes AdvancedCommerceSubscriptionMigrateRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionMigrateRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionMigrateRequest.json",
    );
    expect(request.descriptors).toBeTruthy();
    expect(request.items).toBeTruthy();
    expect(request.taxCode).toBe("taxCode");
    expect(request.targetProductId).toBe("targetProductId");
  });

  it("decodes AdvancedCommerceSubscriptionModifyInAppRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionModifyInAppRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyInAppRequest.json",
    );
    expect(request.currency).toBe("USD");
    expect(request.descriptors).toBeTruthy();
    expect(request.taxCode).toBe("taxCode");
    expect(request.transactionId).toBe("transactionId");
    expect(request.retainBillingCycle).toBe(true);
  });

  it("decodes AdvancedCommerceSubscriptionReactivateInAppRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionReactivateInAppRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionReactivateInAppRequest.json",
    );
    expect(request.items).toBeTruthy();
    expect(request.transactionId).toBe("transactionId");
  });

  it("decodes AdvancedCommerceSubscriptionChangeMetadataRequest", () => {
    const request = decode(
      AdvancedCommerceSubscriptionChangeMetadataRequestSchema,
      "tests/resources/models/advancedCommerceSubscriptionChangeMetadataRequest.json",
    );
    expect(request.items).toBeTruthy();
    expect(request.requestInfo).toBeTruthy();
  });

  it("decodes AdvancedCommerceSubscriptionMigrateDescriptors", () => {
    const descriptors = decode(
      AdvancedCommerceSubscriptionMigrateDescriptorsSchema,
      "tests/resources/models/advancedCommerceSubscriptionMigrateDescriptors.json",
    );
    expect(descriptors.description).toBe("description");
    expect(descriptors.displayName).toBe("displayName");
  });

  it("decodes AdvancedCommerceSubscriptionModifyDescriptors", () => {
    const descriptors = decode(
      AdvancedCommerceSubscriptionModifyDescriptorsSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyDescriptors.json",
    );
    expect(descriptors.description).toBe("description");
    expect(descriptors.displayName).toBe("displayName");
    expect(descriptors.effective).toBe(AdvancedCommerceEffective.IMMEDIATELY);
  });

  it("decodes AdvancedCommerceSubscriptionChangeMetadataDescriptors", () => {
    const descriptors = decode(
      AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema,
      "tests/resources/models/advancedCommerceSubscriptionChangeMetadataDescriptors.json",
    );
    expect(descriptors.description).toBe("description");
    expect(descriptors.displayName).toBe("displayName");
    expect(descriptors.effective).toBe(AdvancedCommerceEffective.IMMEDIATELY);
  });

  it("decodes AdvancedCommerceSubscriptionMigrateItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionMigrateItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionMigrateItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.description).toBe("description");
    expect(item.displayName).toBe("displayName");
  });

  it("decodes AdvancedCommerceSubscriptionMigrateRenewalItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionMigrateRenewalItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionMigrateRenewalItem.json",
    );
    expect(item.SKU).toBe("sku");
  });

  it("decodes AdvancedCommerceSubscriptionModifyAddItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionModifyAddItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyAddItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.price).toBe(12000);
  });

  it("decodes AdvancedCommerceSubscriptionModifyChangeItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionModifyChangeItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyChangeItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.currentSKU).toBe("currentSku");
    expect(item.price).toBe(13000);
    expect(item.effective).toBe(AdvancedCommerceEffective.IMMEDIATELY);
    expect(item.reason).toBe(AdvancedCommerceReason.UPGRADE);
  });

  it("decodes AdvancedCommerceSubscriptionModifyRemoveItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionModifyRemoveItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyRemoveItem.json",
    );
    expect(item.SKU).toBe("sku");
  });

  it("decodes AdvancedCommerceSubscriptionModifyPeriodChange", () => {
    const change = decode(
      AdvancedCommerceSubscriptionModifyPeriodChangeSchema,
      "tests/resources/models/advancedCommerceSubscriptionModifyPeriodChange.json",
    );
    expect(change.period).toBe(AdvancedCommercePeriod.P3M);
    expect(change.effective).toBe(AdvancedCommerceEffective.IMMEDIATELY);
  });

  it("decodes AdvancedCommerceSubscriptionPriceChangeItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionPriceChangeItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionPriceChangeItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.price).toBe(16000);
    expect(item.dependentSKUs?.[0]).toBe("dependentSKU");
  });

  it("decodes AdvancedCommerceSubscriptionReactivateItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionReactivateItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionReactivateItem.json",
    );
    expect(item.SKU).toBe("sku");
  });

  it("decodes AdvancedCommerceSubscriptionChangeMetadataItem", () => {
    const item = decode(
      AdvancedCommerceSubscriptionChangeMetadataItemSchema,
      "tests/resources/models/advancedCommerceSubscriptionChangeMetadataItem.json",
    );
    expect(item.SKU).toBe("sku");
    expect(item.currentSKU).toBe("currentSku");
    expect(item.effective).toBe(AdvancedCommerceEffective.NEXT_BILL_CYCLE);
  });

  it("decodes AdvancedCommerceRequestInfo", () => {
    const info = decode(
      AdvancedCommerceRequestInfoSchema,
      "tests/resources/models/advancedCommerceRequestInfo.json",
    );
    expect(info.requestReferenceId).toBe("550e8400-e29b-41d4-a716-446655440010");
    expect(info.appAccountToken).toBe("660e8400-e29b-41d4-a716-446655440011");
    expect(info.consistencyToken).toBe("consistency_token_value");
  });

  it("decodes AdvancedCommerceSubscriptionMigrateResponse", () => {
    const response = decode(
      AdvancedCommerceSubscriptionMigrateResponseSchema,
      "tests/resources/models/advancedCommerceSubscriptionMigrateResponse.json",
    );
    expect(response.signedRenewalInfo).toBe("signed_renewal_info_value");
    expect(response.signedTransactionInfo).toBe("signed_transaction_info_value");
  });

  it("preserves OneTimeChargeCreateRequest operation and version", () => {
    const request = Schema.decodeUnknownSync(AdvancedCommerceOneTimeChargeCreateRequestSchema)({
      ...JSON.parse(
        readFile("tests/resources/models/advancedCommerceOneTimeChargeCreateRequest.json"),
      ),
      operation: "CREATE_ONE_TIME_CHARGE",
      version: "1",
    });

    const serialized = JSON.parse(JSON.stringify(unwrapOptionsDeep(request)));
    expect(serialized.operation).toBe("CREATE_ONE_TIME_CHARGE");
    expect(serialized.version).toBe("1");
  });

  it("preserves SubscriptionCreateRequest operation and version", () => {
    const request = Schema.decodeUnknownSync(AdvancedCommerceSubscriptionCreateRequestSchema)({
      ...JSON.parse(
        readFile("tests/resources/models/advancedCommerceSubscriptionCreateRequest.json"),
      ),
      operation: "CREATE_SUBSCRIPTION",
      version: "1",
    });

    const serialized = JSON.parse(JSON.stringify(unwrapOptionsDeep(request)));
    expect(serialized.operation).toBe("CREATE_SUBSCRIPTION");
    expect(serialized.version).toBe("1");
  });

  it("preserves SubscriptionModifyInAppRequest operation and version", () => {
    const request = Schema.decodeUnknownSync(AdvancedCommerceSubscriptionModifyInAppRequestSchema)({
      ...JSON.parse(
        readFile("tests/resources/models/advancedCommerceSubscriptionModifyInAppRequest.json"),
      ),
      operation: "MODIFY_SUBSCRIPTION",
      version: "1",
    });

    const serialized = JSON.parse(JSON.stringify(unwrapOptionsDeep(request)));
    expect(serialized.operation).toBe("MODIFY_SUBSCRIPTION");
    expect(serialized.version).toBe("1");
  });

  it("preserves SubscriptionReactivateInAppRequest operation and version", () => {
    const request = Schema.decodeUnknownSync(
      AdvancedCommerceSubscriptionReactivateInAppRequestSchema,
    )({
      ...JSON.parse(
        readFile("tests/resources/models/advancedCommerceSubscriptionReactivateInAppRequest.json"),
      ),
      operation: "REACTIVATE_SUBSCRIPTION",
      version: "1",
    });

    const serialized = JSON.parse(JSON.stringify(unwrapOptionsDeep(request)));
    expect(serialized.operation).toBe("REACTIVATE_SUBSCRIPTION");
    expect(serialized.version).toBe("1");
  });
});
