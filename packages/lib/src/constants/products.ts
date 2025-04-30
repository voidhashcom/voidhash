export const PRODUCT_TYPES = [
	"subscription",
	"one_time",
	"one_time_consumable",
] as const;

export const PRODUCT_TYPE_LABELS: Record<
	(typeof PRODUCT_TYPES)[number],
	string
> = {
	subscription: "Subscription",
	one_time: "Non-consumable",
	one_time_consumable: "Consumable",
} as const;
