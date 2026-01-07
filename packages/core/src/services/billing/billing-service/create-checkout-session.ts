import { eq, organizationBilling } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect } from "effect";

import {
  BillingServiceError,
  InvalidBillingTierError,
  OrganizationBillingNotFoundError,
} from "../../../billing/errors";
import type {
  BillingTierNameValue,
  CheckoutSessionResult,
} from "../../../billing/types";
import { BillingProvider } from "../providers/billing-provider";

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) =>
      db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId),
      })
    )
  );

export const createCheckoutSession = Effect.gen(
  function* createCheckoutSession() {
    const db = yield* Db;
    const billingProvider = yield* BillingProvider;

    return Effect.fn("BillingService.createCheckoutSession")(
      function* createCheckoutSession(input: {
        organizationId: string;
        tier: BillingTierNameValue;
        successUrl: string;
        cancelUrl: string;
      }) {
        // Can only upgrade to pro or enterprise
        if (input.tier === "free") {
          return yield* Effect.fail(
            new InvalidBillingTierError({
              message: "Cannot create checkout for free tier",
              tier: input.tier,
            })
          );
        }

        // Get organization billing to get external customer ID
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

        if (!billing.externalCustomerId) {
          return yield* Effect.fail(
            new BillingServiceError({
              message: "Organization does not have a billing customer ID",
            })
          );
        }

        // Create checkout session with provider
        const checkoutSession = yield* billingProvider.createCheckoutSession({
          cancelUrl: input.cancelUrl,
          externalCustomerId: billing.externalCustomerId,
          organizationId: input.organizationId,
          successUrl: input.successUrl,
          tier: input.tier,
        });

        yield* Effect.log(
          `Created checkout session ${checkoutSession.id} for org ${input.organizationId} to upgrade to ${input.tier}`
        );

        return checkoutSession;
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
                message: "Failed to create checkout session",
              }),
          })
        )
    );
  }
);
