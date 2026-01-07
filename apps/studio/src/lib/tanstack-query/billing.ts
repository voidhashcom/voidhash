import { Effect } from 'effect';
import { eq, VoidhashRpc } from '../effect-query';
import { queryKeys } from './query-keys';

export const getOrganizationBillingOptions = (opts: {
  organizationId: string;
}) =>
  eq.queryOptions({
    queryKey: queryKeys.billing.getOrganizationBilling(opts.organizationId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.GetOrganizationBilling(opts))
      )
  });

export const getUsageSummariesOptions = (opts: { organizationId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.billing.getUsageSummaries(opts.organizationId),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.GetUsageSummaries(opts)))
  });

export const createCheckoutSessionOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createCheckoutSession'],
    mutationFn: (variables: {
      organizationId: string;
      tier: 'pro' | 'enterprise';
      successUrl: string;
      cancelUrl: string;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateCheckoutSession(variables))
      )
  });

export const cancelSubscriptionOptions = () =>
  eq.mutationOptions({
    mutationKey: ['cancelSubscription'],
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CancelSubscription(variables))
      )
  });
