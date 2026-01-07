import { eq, organizationBilling } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect } from "effect";

import {
  BillingServiceError,
  OrganizationBillingNotFoundError,
} from "../../../billing/errors";
import { BillingProvider } from "../providers/billing-provider";

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) =>
      db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId),
      })
    )
  );

export const cancelSubscription = Effect.gen(function* cancelSubscription() {
  const db = yield* Db;
  const billingProvider = yield* BillingProvider;

  return Effect.fn("BillingService.cancelSubscription")(
    function* cancelSubscription(input: { organizationId: string }) {
      const billing = yield* _getOrganizationBilling(db)(input.organizationId);

      if (!billing) {
        return yield* Effect.fail(
          new OrganizationBillingNotFoundError({
            organizationId: input.organizationId,
          })
        );
      }

      if (!billing.externalSubscriptionId) {
        return yield* Effect.fail(
          new BillingServiceError({
            message: "Organization does not have an active subscription",
          })
        );
      }

      // Cancel subscription with provider
      yield* billingProvider.cancelSubscription(billing.externalSubscriptionId);

      yield* Effect.log(
        `Canceled subscription ${billing.externalSubscriptionId} for org ${input.organizationId}`
      );

      // The actual status update will happen via webhook
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          BillingProviderError: (error) =>
            new BillingServiceError({
              cause: error.cause,
              message: `Billing provider error: ${error.message}`,
            }),
          DatabaseError: (error) =>
            new BillingServiceError({
              cause: String(error.cause),
              message: "Failed to cancel subscription",
            }),
        })
      )
  );
});
