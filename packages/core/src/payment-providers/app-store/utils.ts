import {
  Environment,
  InAppOwnershipType,
  OfferDiscountType,
  OfferType,
  TransactionReason,
  Type,
} from "@apple/app-store-server-library";

export const fromEnvironment = (environment: Environment) =>
  environment === Environment.PRODUCTION ? "production" : "sandbox";

export const fromOwnershipType = (ownershipType: InAppOwnershipType) =>
  ownershipType === InAppOwnershipType.FAMILY_SHARED
    ? "FAMILY_SHARED"
    : "PURCHASED";

export const fromOfferDiscountType = (offerDiscountType: OfferDiscountType) => {
  switch (offerDiscountType) {
    case OfferDiscountType.FREE_TRIAL: {
      return "FREE_TRIAL";
    }
    case OfferDiscountType.PAY_AS_YOU_GO: {
      return "PAY_AS_YOU_GO";
    }
    case OfferDiscountType.PAY_UP_FRONT: {
      return "PAY_UP_FRONT";
    }
    default: {
      throw new Error("Unknown offer discount type");
    }
  }
};

export const fromOfferType = (offerType: OfferType) => {
  switch (offerType) {
    case OfferType.INTRODUCTORY_OFFER: {
      return "INTRODUCTORY_OFFER";
    }
    case OfferType.PROMOTIONAL_OFFER: {
      return "PROMOTIONAL_OFFER";
    }
    case OfferType.SUBSCRIPTION_OFFER_CODE: {
      return "SUBSCRIPTION_OFFER_CODE";
    }
    case OfferType.WIN_BACK_OFFER: {
      return "WIN_BACK_OFFER";
    }
    default: {
      throw new Error("Unknown offer type");
    }
  }
};

export const fromRevocationReason = (revocationReason: number) => {
  switch (revocationReason) {
    case 1: {
      return "OTHER_REASON";
    }
    case 2: {
      return "PERCEIVED_ISSUE";
    }
    default: {
      throw new Error("Unknown revocation reason");
    }
  }
};

export const fromTransactionReason = (transactionReason: TransactionReason) => {
  switch (transactionReason) {
    case TransactionReason.PURCHASE: {
      return "PURCHASE";
    }
    case TransactionReason.RENEWAL: {
      return "RENEWAL";
    }
    default: {
      throw new Error("Unknown transaction reason");
    }
  }
};

export const fromTransactionType = (transactionType: Type) => {
  switch (transactionType) {
    case Type.AUTO_RENEWABLE_SUBSCRIPTION: {
      return "AUTO_RENEWABLE_SUBSCRIPTION";
    }
    case Type.NON_CONSUMABLE: {
      return "NON_CONSUMABLE";
    }
    case Type.CONSUMABLE: {
      return "CONSUMABLE";
    }
    case Type.NON_RENEWING_SUBSCRIPTION: {
      return "NON_RENEWING_SUBSCRIPTION";
    }
    default: {
      throw new Error("Unknown transaction type");
    }
  }
};
