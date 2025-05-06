export const SUBSCRIPTION_STATUSES = [
	"active",
	"trialing",
	"canceled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
