import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listCustomersOptions = (options: { projectId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.customer.list(options.projectId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListCustomers({ projectId: options.projectId })
        )
      )
  });

export const getCustomerByIdOptions = (options: { customerId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.customer.getCustomer(options.customerId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetCustomerById({ customerId: options.customerId })
        )
      )
  });

export const getCustomerByAppUserIdOptions = (options: {
  projectId: string;
  appUserId: string;
}) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.customer.getCustomerByAppUserId(
      options.projectId,
      options.appUserId
    ),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetCustomerByAppUserId({
            projectId: options.projectId,
            appUserId: options.appUserId
          })
        )
      )
  });

export const createCustomerOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createCustomer',
    mutationFn: (variables: {
      projectId: string;
      appUserId: string;
      name?: string;
      email?: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateCustomer(variables)))
  });
