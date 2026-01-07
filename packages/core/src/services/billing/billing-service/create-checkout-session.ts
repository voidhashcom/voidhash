import { eq, organizationBilling } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';
import {
  BillingServiceError,
  InvalidBillingTierError,
  OrganizationBillingNotFoundError
} from '../../../billing/errors';
import type {
  BillingTierNameValue,
  CheckoutSessionResult
} from '../../../billing/types';
import { BillingProvider } from '../providers/billing-provider';

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) => {
      return db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId)
      });
    })
  );

export const createCheckoutSession = Effect.gen(function* () {
  const db = yield* Db;
  const billingProvider = yield* BillingProvider;

  return Effect.fn('BillingService.createCheckoutSession')(
    function* (input: {
      organizationId: string;
      tier: BillingTierNameValue;
      successUrl: string;
      cancelUrl: string;
    }) {
      // Can only upgrade to pro or enterprise
      if (input.tier === 'free') {
        return yield* Effect.fail(
          new InvalidBillingTierError({
            tier: input.tier,
            message: 'Cannot create checkout for free tier'
          })
        );
      }

      // Get organization billing to get external customer ID
      const billing = yield* _getOrganizationBilling(db)(input.organizationId);

      if (!billing) {
        return yield* Effect.fail(
          new OrganizationBillingNotFoundError({
            organizationId: input.organizationId
          })
        );
      }

      if (!billing.externalCustomerId) {
        return yield* Effect.fail(
          new BillingServiceError({
            message: 'Organization does not have a billing customer ID'
          })
        );
      }

      // Create checkout session with provider
      const checkoutSession = yield* billingProvider.createCheckoutSession({
        organizationId: input.organizationId,
        externalCustomerId: billing.externalCustomerId,
        tier: input.tier,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl
      });

      yield* Effect.log(
        `Created checkout session ${checkoutSession.id} for org ${input.organizationId} to upgrade to ${input.tier}`
      );

      return checkoutSession;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to create checkout session',
              cause: String(error.cause)
            }),
          BillingProviderError: (error) =>
            new BillingServiceError({
              message: `Billing provider error: ${error.message}`,
              cause: error.cause
            })
        })
      )
  );
});
