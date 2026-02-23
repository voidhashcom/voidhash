import { schemaConfiguration, unlockablePerk } from "../../core/schema";
import type { VoidhashSchema } from "../../core/schema/types";

export function createTestSchema() {
  const schemaConfig = schemaConfiguration({
    perks: {
      allAccess: unlockablePerk("all-access", { name: "All Access" }),
    },
    providers: {
      appleAppStore: true,
      googlePlay: true,
    },
  });

  const schema = {
    monthlySub: schemaConfig.subscription("monthly_sub", {
      name: "Monthly",
      perks: {
        allAccess: true,
      },
      providers: {
        appleAppStore: {
          productId: "com.voidhash.monthly.ios",
        },
        googlePlay: {
          productId: "com.voidhash.monthly.android",
        },
      },
    }),
    schemaConfig,
    yearlySub: schemaConfig.subscription("yearly_sub", {
      name: "Yearly",
      perks: {
        allAccess: true,
      },
      providers: {
        appleAppStore: {
          productId: "com.voidhash.yearly.ios",
        },
        googlePlay: {
          basePlanId: "yearly-base",
          productId: "com.voidhash.yearly.android",
        },
      },
    }),
  } satisfies VoidhashSchema;

  return schema;
}
