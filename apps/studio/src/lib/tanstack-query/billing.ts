import { Effect } from "effect";

import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

export const getOrganizationBillingOptions = (opts: {
  organizationId: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.GetOrganizationBilling(opts))
      ),
    queryKey: queryKeys.billing.getOrganizationBilling(opts.organizationId),
  });

export const getUsageSummariesOptions = (opts: { organizationId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.GetUsageSummaries(opts))),
    queryKey: queryKeys.billing.getUsageSummaries(opts.organizationId),
  });

export const createCheckoutSessionOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      organizationId: string;
      tier: "pro" | "enterprise";
      successUrl: string;
      cancelUrl: string;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateCheckoutSession(variables))
      ),
    mutationKey: ["createCheckoutSession"],
  });

export const cancelSubscriptionOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CancelSubscription(variables))
      ),
    mutationKey: ["cancelSubscription"],
  });
