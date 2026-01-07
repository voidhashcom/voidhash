import {
  BillingSubscriptionStatus,
  BillingTier,
  eq,
  organizationBilling,
  type InsertOrganizationBilling
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { Effect } from 'effect';
import { BillingServiceError } from '../../../billing/errors';
import { BillingProvider } from '../providers/billing-provider';

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) => {
      return db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId)
      });
    })
  );

const _insertOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, billing: InsertOrganizationBilling) =>
    execute(async (db) => {
      await db.insert(organizationBilling).values(billing);
      return { id: billing.id };
    })
  );

export const initializeOrganizationBilling = Effect.gen(function* () {
  const db = yield* Db;
  const billingProvider = yield* BillingProvider;

  return Effect.fn('BillingService.initializeOrganizationBilling')(
    function* (input: { organizationId: string; email?: string }) {
      // Check if billing already exists
      const existing = yield* _getOrganizationBilling(db)(input.organizationId);
      if (existing) {
        yield* Effect.log(
          `Billing already initialized for org ${input.organizationId}`
        );
        return existing;
      }

      // Sync customer with billing provider
      const customerInfo = yield* billingProvider.syncCustomer(
        input.organizationId,
        input.email
      );

      // Create local billing record
      const billingRecord: InsertOrganizationBilling = {
        id: generateId('organizationBilling'),
        organizationId: input.organizationId,
        tier: BillingTier.Free,
        billingProviderId: billingProvider.config.id,
        externalCustomerId: customerInfo.externalCustomerId,
        subscriptionStatus: BillingSubscriptionStatus.None,
        externalSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null
      };

      yield* _insertOrganizationBilling(db)(billingRecord);

      yield* Effect.log(
        `Initialized billing for org ${input.organizationId} with provider ${billingProvider.config.name}`
      );

      return {
        ...billingRecord,
        createdAt: new Date(),
        updatedAt: null
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to initialize organization billing',
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
