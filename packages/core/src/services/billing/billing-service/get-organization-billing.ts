import { eq, organizationBilling } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect } from "effect";

import {
  BillingServiceError,
  OrganizationBillingNotFoundError,
} from "../../../billing/errors";
import type {
  BillingTierNameValue,
  OrganizationBillingInfo,
} from "../../../billing/types";
import { UsageService } from "../usage-service";

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) =>
      db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId),
      })
    )
  );

/**
 * Map database tier value to tier name
 */
function mapTierToName(tier: number): BillingTierNameValue {
  switch (tier) {
    case 1: {
      return "free";
    }
    case 2: {
      return "pro";
    }
    case 3: {
      return "enterprise";
    }
    default: {
      return "free";
    }
  }
}

/**
 * Map database subscription status to string
 */
function mapSubscriptionStatus(
  status: number
): "none" | "active" | "canceled" | "past_due" | "trialing" {
  switch (status) {
    case 0: {
      return "none";
    }
    case 1: {
      return "active";
    }
    case 2: {
      return "canceled";
    }
    case 3: {
      return "past_due";
    }
    case 4: {
      return "trialing";
    }
    default: {
      return "none";
    }
  }
}

export const getOrganizationBilling = Effect.gen(
  function* getOrganizationBilling() {
    const db = yield* Db;
    const usageService = yield* UsageService;

    return Effect.fn("BillingService.getOrganizationBilling")(
      function* getOrganizationBilling(input: { organizationId: string }) {
        const billing = yield* _getOrganizationBilling(db)(
          input.organizationId
        );

        if (!billing) {
          return yield* Effect.fail(
            new OrganizationBillingNotFoundError({
              organizationId: input.organizationId,
            })
          );
        }

        // Get usage summaries
        const usageSummaries = yield* usageService.getAllUsageSummaries({
          organizationId: input.organizationId,
        });

        return {
          currentPeriodEnd: billing.currentPeriodEnd,
          currentPeriodStart: billing.currentPeriodStart,
          organizationId: input.organizationId,
          subscriptionStatus: mapSubscriptionStatus(billing.subscriptionStatus),
          tier: mapTierToName(billing.tier),
          usageSummaries,
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            DatabaseError: (error) =>
              new BillingServiceError({
                cause: String(error.cause),
                message: "Failed to get organization billing",
              }),
          })
        )
    );
  }
);
