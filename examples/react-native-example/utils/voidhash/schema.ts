import { schemaConfiguration, unlockablePerk } from "@voidhash/react-native";

export const sc = schemaConfiguration({
  perks: {
    allAccess: unlockablePerk("all-access", {
      name: "All Access",
    }),
  },
  providers: {
    appleAppStore: true,
    googlePlay: true,
  },
});

export const monthlySub = sc.subscription("monthly_sub", {
  name: "Monthly",
  perks: {
    allAccess: true,
  },
  providers: {
    appleAppStore: {
      productId: "test_group_monthly",
    },
    googlePlay: {
      productId: "com.voidhash.example.monthly",
    },
  },
});

export const yearlySub = sc.subscription("yearly_sub", {
  name: "Yearly",
  perks: {
    allAccess: true,
  },
  providers: {
    appleAppStore: {
      productId: "test_group_yearly",
    },
    googlePlay: {
      basePlanId: "com.voidhash.example.yearly.base",
      productId: "com.voidhash.example.yearly",
    },
  },
});
