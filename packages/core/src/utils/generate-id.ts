import { createId } from "@paralleldrive/cuid2";

const prefixes = {
  test: "test",
  request: "req",
  user: "user",
  organization: "org",
  member: "member",
  workosWebhookEvent: "workos_wh",
  apiSecretKey: "api_sk",
  apiPublishableKey: "api_pk",
  apiPublishableKeyTesting: "api_pk_test",
  person: "person",
  personDistinctId: "person_dist",
  personIdentityMigrationJob: "person_id_mig",
  identityAssertion: "id_assert",
  purchase: "pur",
  paywall: "pw",
  paywallEditToken: "pw_et",
  paywallProduct: "pw_prod",
  paywallRelease: "pw_pub",
  paymentProviderConfiguration: "pp_conf",
  paymentProviderProduct: "pp_prod",
  product: "prod",
  project: "proj",
  perk: "perk",
  productPerk: "prod_perk",
  paywallLocation: "pw_loc",
  paywallLocationShowing: "pw_loc_show",
  paywallDeploy: "pw_dep",
  paywallDeployFile: "pw_dep_file",
  paywallDeployBlob: "pw_blob",
  paywallComponent: "pw_cmp",
  paywallComponentVersion: "pw_cmp_ver",
  personUnlockedPerk: "person_perk",
  checkoutSession: "ch_sess",
  transaction: "tx",
  outbox: "outbox",
  fxRate: "fx",
  purchaseLedger: "pl",
  paymentProviderNotification: "ppn",
  subscription: "sub",
  subscriptionTransfer: "sub_xfer",
  purchaseTransfer: "pur_xfer",
  appStoreTransaction: "app_store_tx",
  analyticsIngestDlq: "an_ing_dlq",
  analyticsEvent: "an_evt",
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
  // Audit Log
  auditLog: "audit",
  // Feature Flags
  featureFlag: "ff",
  featureFlagTarget: "ff_tgt",
  featureFlagOverride: "ff_ovr",
  featureFlagVariant: "ff_var",
  featureFlagAuditLog: "ff_log",
  featureFlagExposure: "ff_exp",
  // Experiments
  experiment: "exp",
  experimentVariant: "exp_var",
  experimentTreatment: "exp_trt",
  // Internal feature flags (voidhash-internal product gating)
  internalFeatureFlagOverride: "iff_ovr",
  // Organization-scoped paywall image asset library
  paywallAsset: "pw_asset",
  // Voidhash AI chat persistence (the chat id is minted client-side; this
  // prefix is used for server-side fallbacks and stored attachment objects)
  aiChat: "ai_chat",
  aiChatAttachment: "ai_att",
  // Per-turn AI checkpoint pre-image row (server-minted).
  aiCheckpoint: "ai_ckpt",
  // Internal voidhash product feedback (distinct from any future customer-facing
  // feedback-collection product, which could own the plain `fb` prefix)
  voidhashFeedback: "vh_fb",
  // VoidQL analytics
  analyticsSavedQuery: "an_sq",
  // Push notifications (push_ namespace avoids the entrenched ppn webhook domain)
  pushNotificationConfig: "push_conf",
  pushDeviceToken: "push_tok",
  personPushDeviceToken: "push_person_tok",
  pushNotificationSend: "push_send",
  pushNotificationDelivery: "push_del",
  pushNotificationDeliveryAttempt: "push_att",
} as const;

export const generateId = <TPrefix extends keyof typeof prefixes>(prefix: TPrefix) =>
  `${prefixes[prefix]}_${createId()}`;
