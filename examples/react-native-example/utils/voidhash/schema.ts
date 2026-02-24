import { schemaConfiguration, unlockablePerk } from "@voidhash/react-native";

export const sc = schemaConfiguration({
  perks: {
    allAccess: unlockablePerk("all-access", { name: "All Access" }),
  },
  providers: {
  },
});

export const examplePaywallLocation = sc.location("example-paywall", {
  name: "Example Paywall",
  description: "A paywall for testing purposes",
})

export const monthlySub = sc.subscription("monthly_sub", {
  name: "Monthly",
  perks: {
    allAccess: true,
  },
  providers: {
  },
});

export const yearlySub = sc.subscription("yearly_sub", {
  name: "Yearly",
  perks: {
    allAccess: true,
  },
  providers: {
  },
});
