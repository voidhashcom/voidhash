import {
	schemaConfiguration,
	unlockablePerk,
} from "@voidhash/react-native/schema";

export const schema = schemaConfiguration({
	perks: {
		allAccess: unlockablePerk("all-access", { name: "All Access" }),
		premiumFeatures: unlockablePerk("premium-features", {
			name: "Premium Features",
		}),
	},
	providers: {
		appleAppStore: true,
		googlePlay: true,
	},
});

export const monthlyPlan = schema.subscription("monthly-plan", {
	name: "Monthly Plan",
	perks: { allAccess: true },
	providers: {
		appleAppStore: { productId: "com.example.monthly" },
		googlePlay: { productId: "monthly_subscription" },
	},
});

export const yearlyPlan = schema.subscription("yearly-plan", {
	name: "Yearly Plan",
	perks: { allAccess: true, premiumFeatures: true },
	providers: {
		appleAppStore: { productId: "com.example.yearly" },
		googlePlay: { productId: "yearly_subscription", basePlanId: "base-yearly" },
	},
});
