import {
  BillingSubscriptionStatus,
  BillingTier,
  eq,
  organizationBilling
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';
import { BillingServiceError } from '../../../billing/errors';
import type { SubscriptionChangeEvent } from '../../../billing/types';

const _getOrganizationBillingByExternalCustomerId = (db: Db) =>
  db.makeQuery((execute, externalCustomerId: string) =>
    execute(async (db) => {
      return db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.externalCustomerId, externalCustomerId)
      });
    })
  );

const _updateOrganizationBilling = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        id: string;
        tier: number;
        subscriptionStatus: number;
        externalSubscriptionId: string | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
      }
    ) =>
      execute(async (db) => {
        await db
          .update(organizationBilling)
          .set({
            tier: input.tier,
            subscriptionStatus: input.subscriptionStatus,
            externalSubscriptionId: input.externalSubscriptionId,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd
          })
          .where(eq(organizationBilling.id, input.id));
      })
  );

/**
 * Map tier name to database value
 */
function mapTierToValue(tier: string | undefined): number {
  switch (tier) {
    case 'pro':
      return BillingTier.Pro;
    case 'enterprise':
      return BillingTier.Enterprise;
    default:
      return BillingTier.Free;
  }
}

/**
 * Map subscription status to database value
 */
function mapStatusToValue(
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
): number {
  switch (status) {
    case 'active':
      return BillingSubscriptionStatus.Active;
    case 'canceled':
      return BillingSubscriptionStatus.Canceled;
    case 'past_due':
      return BillingSubscriptionStatus.PastDue;
    case 'trialing':
      return BillingSubscriptionStatus.Trialing;
    default:
      return BillingSubscriptionStatus.None;
  }
}

export const handleSubscriptionChange = Effect.gen(function* () {
  const db = yield* Db;

  return Effect.fn('BillingService.handleSubscriptionChange')(
    function* (event: SubscriptionChangeEvent) {
      // Find organization by external customer ID
      const billing = yield* _getOrganizationBillingByExternalCustomerId(db)(
        event.externalCustomerId
      );

      if (!billing) {
        yield* Effect.log(
          `No billing record found for external customer ${event.externalCustomerId}`
        );
        return;
      }

      // Update billing record
      yield* _updateOrganizationBilling(db)({
        id: billing.id,
        tier: event.tier ? mapTierToValue(event.tier) : billing.tier,
        subscriptionStatus: mapStatusToValue(event.status),
        externalSubscriptionId: event.externalSubscriptionId,
        currentPeriodStart: event.currentPeriodStart ?? null,
        currentPeriodEnd: event.currentPeriodEnd ?? null
      });

      yield* Effect.log(
        `Updated billing for org ${billing.organizationId}: status=${event.status}, tier=${event.tier ?? 'unchanged'}`
      );
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to handle subscription change',
              cause: String(error.cause)
            })
        })
      )
  );
});
