import { BillingService, UsageService } from '@voidhash/core/services';
import { BillingRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const BillingRpcsLive = BillingRpcsDef.toLayer(
  Effect.gen(function* () {
    const billingService = yield* BillingService;
    const usageService = yield* UsageService;

    return {
      GetOrganizationBilling: ({ organizationId }) =>
        billingService.getOrganizationBilling({ organizationId }),

      GetUsageSummaries: ({ organizationId }) =>
        usageService.getAllUsageSummaries({ organizationId }),

      CreateCheckoutSession: ({ organizationId, tier, successUrl, cancelUrl }) =>
        billingService.createCheckoutSession({
          organizationId,
          tier,
          successUrl,
          cancelUrl
        }),

      CancelSubscription: ({ organizationId }) =>
        billingService.cancelSubscription({ organizationId })
    };
  })
).pipe(
  Layer.provide(BillingService.Default),
  Layer.provide(UsageService.Default)
);
