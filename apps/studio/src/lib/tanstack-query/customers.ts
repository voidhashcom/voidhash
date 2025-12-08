import { Effect } from 'effect';
import { queryKeys } from 'src/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listCustomersOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.customer.list(options.projectId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListCustomers({ projectId: options.projectId })
        )
      )
  });

export const getCustomerByIdOptions = (options: { customerId: string }) =>
  eq.queryOptions({
    queryKey: [
      'customers',
      'getCustomerById',
      { customerId: options.customerId }
    ],
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
  eq.queryOptions({
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
  eq.mutationOptions({
    mutationKey: ['createCustomer'],
    mutationFn: (variables: {
      projectId: string;
      appUserId: string;
      name?: string;
      email?: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateCustomer(variables)))
  });
