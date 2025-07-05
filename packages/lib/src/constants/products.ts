export const ProductType = {
	Subscription: 1,
	OneTime: 2,
	OneTimeConsumable: 3,
} as const;

export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeLabels: Record<ProductTypeValue, string> = {
	[ProductType.Subscription]: "Subscription",
	[ProductType.OneTime]: "Non-consumable",
	[ProductType.OneTimeConsumable]: "Consumable",
} as const;
