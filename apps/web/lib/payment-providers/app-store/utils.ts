import {
	Environment,
	OfferDiscountType,
	OfferType,
	OwnershipType,
	TransactionReason,
	TransactionType,
} from "app-store-server-api";

export const fromEnvironment = (environment: Environment) => {
	return environment === Environment.Production ? "production" : "sandbox";
};

export const fromOwnershipType = (ownershipType: OwnershipType) => {
	return ownershipType === OwnershipType.FamilyShared
		? "FAMILY_SHARED"
		: "PURCHASED";
};

export const fromOfferDiscountType = (offerDiscountType: OfferDiscountType) => {
	switch (offerDiscountType) {
		case OfferDiscountType.FreeTrial:
			return "FREE_TRIAL";
		case OfferDiscountType.PayAsYouGo:
			return "PAY_AS_YOU_GO";
		case OfferDiscountType.PayUpFront:
			return "PAY_UP_FRONT";
	}
};

export const fromOfferType = (offerType: OfferType) => {
	switch (offerType) {
		case OfferType.Introductory:
			return "INTRODUCTORY_OFFER";
		case OfferType.Promotional:
			return "PROMOTIONAL_OFFER";
		case OfferType.SubscriptionOfferCode:
			return "OFFER_WITH_SUBSCRIPTION_OFFER_CODE";
		case OfferType.WinBackOffer:
			return "WIN_BACK_OFFER";
	}
};

export const fromRevocationReason = (revocationReason: number) => {
	switch (revocationReason) {
		case 1:
			return "OTHER_REASON";
		case 2:
			return "PERCEIVED_ISSUE";
	}
};

export const fromTransactionReason = (transactionReason: TransactionReason) => {
	switch (transactionReason) {
		case TransactionReason.Purchase:
			return "PURCHASE";
		case TransactionReason.Renewal:
			return "RENEWAL";
	}
};

export const fromTransactionType = (transactionType: TransactionType) => {
	switch (transactionType) {
		case TransactionType.AutoRenewableSubscription:
			return "AUTO_RENEWABLE_SUBSCRIPTION";
		case TransactionType.NonConsumable:
			return "NON_CONSUMABLE";
		case TransactionType.Consumable:
			return "CONSUMABLE";
		case TransactionType.NonRenewingSubscription:
			return "NON_RENEWING_SUBSCRIPTION";
	}
};
