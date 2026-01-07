import { BillingService, UsageService } from "@voidhash/core/services";
import { BillingRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const BillingRpcsLive = BillingRpcsDef.toLayer(
  Effect.gen(function* BillingRpcsLive() {
    const billingService = yield* BillingService;
    const usageService = yield* UsageService;

    return {
      CancelSubscription: ({ organizationId }) =>
        billingService.cancelSubscription({ organizationId }),

      CreateCheckoutSession: ({
        organizationId,
        tier,
        successUrl,
        cancelUrl,
      }) =>
        billingService.createCheckoutSession({
          cancelUrl,
          organizationId,
          successUrl,
          tier,
        }),

      GetOrganizationBilling: ({ organizationId }) =>
        billingService.getOrganizationBilling({ organizationId }),

      GetUsageSummaries: ({ organizationId }) =>
        usageService.getAllUsageSummaries({ organizationId }),
    };
  })
).pipe(
  Layer.provide(BillingService.Default),
  Layer.provide(UsageService.Default)
);
