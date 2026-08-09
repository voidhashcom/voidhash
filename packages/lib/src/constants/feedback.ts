/**
 * Shared enums for the in-app feedback widget. The customer-facing popover,
 * stored feedback record, notification relay, and moderation UI all read these
 * so the label/value mapping lives in exactly one place.
 */

import { constant } from "../lang/index.ts";

/**
 * Which product area the feedback is about. Stored verbatim as a slug
 * (varchar). These are product areas, not feedback *types* (bug/idea) — so the
 * inbox can be triaged by the surface a user is talking about. Extend this list
 * as the product grows; keep slugs ≤ 32 chars (the column limit).
 */
export const FeedbackTopic = constant({
  Analytics: "analytics",
  Paywalls: "paywalls",
  Products: "products",
  Persons: "persons",
  FeatureFlags: "feature_flags",
  Experiments: "experiments",
  PaymentProviders: "payment_providers",
  Webhooks: "webhooks",
  Sdk: "sdk",
  Billing: "billing",
  Dashboard: "dashboard",
  Other: "other",
});

export type FeedbackTopicValue = (typeof FeedbackTopic)[keyof typeof FeedbackTopic];

/** The ordered list of topic values, for building the topic select. */
export const FeedbackTopicValues = constant([
  FeedbackTopic.Analytics,
  FeedbackTopic.Paywalls,
  FeedbackTopic.Products,
  FeedbackTopic.Persons,
  FeedbackTopic.FeatureFlags,
  FeedbackTopic.Experiments,
  FeedbackTopic.PaymentProviders,
  FeedbackTopic.Webhooks,
  FeedbackTopic.Sdk,
  FeedbackTopic.Billing,
  FeedbackTopic.Dashboard,
  FeedbackTopic.Other,
]);

export const FeedbackTopicLabels: Record<FeedbackTopicValue, string> = {
  [FeedbackTopic.Analytics]: "Analytics",
  [FeedbackTopic.Paywalls]: "Paywalls",
  [FeedbackTopic.Products]: "Products & Catalog",
  [FeedbackTopic.Persons]: "Persons & Identity",
  [FeedbackTopic.FeatureFlags]: "Feature Flags",
  [FeedbackTopic.Experiments]: "A/B Tests",
  [FeedbackTopic.PaymentProviders]: "Payment Providers",
  [FeedbackTopic.Webhooks]: "Webhooks & API",
  [FeedbackTopic.Sdk]: "SDKs",
  [FeedbackTopic.Billing]: "Billing",
  [FeedbackTopic.Dashboard]: "Dashboard (UI, Navigation)",
  [FeedbackTopic.Other]: "Other",
};

/**
 * Sentiment on an ordinal 1–4 scale (stored as `smallint`). The UI renders each
 * level with a lucide icon (frown → annoyed → smile → laugh); the numeric value
 * keeps ordering/aggregation cheap and decouples storage from the icon set.
 */
export const FeedbackSentiment = constant({
  Frown: 1,
  Annoyed: 2,
  Smile: 3,
  Laugh: 4,
});

export type FeedbackSentimentValue = (typeof FeedbackSentiment)[keyof typeof FeedbackSentiment];

export const FeedbackSentimentValues = constant([
  FeedbackSentiment.Frown,
  FeedbackSentiment.Annoyed,
  FeedbackSentiment.Smile,
  FeedbackSentiment.Laugh,
]);

export const FeedbackSentimentLabels: Record<FeedbackSentimentValue, string> = {
  [FeedbackSentiment.Frown]: "Very unhappy",
  [FeedbackSentiment.Annoyed]: "Unhappy",
  [FeedbackSentiment.Smile]: "Happy",
  [FeedbackSentiment.Laugh]: "Very happy",
};

/**
 * Triage state for a stored feedback item, driven from the moderation inbox.
 * `New` is the default on insert; the inbox transitions it to `Read`/`Archived`.
 */
export const FeedbackStatus = constant({
  New: 0,
  Read: 1,
  Archived: 2,
});

export type FeedbackStatusValue = (typeof FeedbackStatus)[keyof typeof FeedbackStatus];

export const FeedbackStatusValues = constant([
  FeedbackStatus.New,
  FeedbackStatus.Read,
  FeedbackStatus.Archived,
]);

export const FeedbackStatusLabels: Record<FeedbackStatusValue, string> = {
  [FeedbackStatus.New]: "New",
  [FeedbackStatus.Read]: "Read",
  [FeedbackStatus.Archived]: "Archived",
};
