import { createId } from "@paralleldrive/cuid2";

const prefixes = {
	test: "test",
	request: "req",
	user: "user",
	organization: "org",
	apiSecretKey: "api_sk",
	apiPublishableKey: "api_pk",
	apiPublishableKeyTesting: "api_pk_test",
	customer: "cust",
	purchase: "pur",
	paywall: "pw",
	paywallEditToken: "pw_et",
	paywallProduct: "pw_prod",
	paywallPublishedVersion: "pw_pub",
	paymentProviderConfiguration: "pp_conf",
	paymentProviderProduct: "pp_prod",
	product: "prod",
	project: "proj",
	perk: "perk",
	productPerk: "prod_perk",
	paywallLocation: "pw_loc",
	customerUnlockedPerk: "cust_perk",
	checkoutSession: "ch_sess",
	transaction: "tx",
	outbox: "outbox",
	subscription: "sub",
	appStoreTransaction: "app_store_tx",
	changesetDeployment: "chd",
	// Billing
	organizationBilling: "org_bill",
	usageRecord: "usage",
	usageAggregate: "usage_agg",
	billingWebhookEvent: "bill_wh",
	billingProviderMeter: "bill_meter",
	// Webhooks
	webhookEndpoint: "wh_ep",
	webhookDelivery: "wh_del",
	webhookDeliveryAttempt: "wh_att",
} as const;

export const generateId = <TPrefix extends keyof typeof prefixes>(
	prefix: TPrefix,
) => {
	return `${prefixes[prefix]}_${createId()}`;
};
