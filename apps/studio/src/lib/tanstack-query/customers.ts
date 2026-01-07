import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listCustomersOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListCustomers({ projectId: options.projectId })
        )
      ),
    queryKey: queryKeys.customer.list(options.projectId),
  });

export const getCustomerByIdOptions = (options: { customerId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetCustomerById({ customerId: options.customerId })
        )
      ),
    queryKey: [
      "customers",
      "getCustomerById",
      { customerId: options.customerId },
    ],
  });

export const getCustomerByAppUserIdOptions = (options: {
  projectId: string;
  appUserId: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetCustomerByAppUserId({
            appUserId: options.appUserId,
            projectId: options.projectId,
          })
        )
      ),
    queryKey: queryKeys.customer.getCustomerByAppUserId(
      options.projectId,
      options.appUserId
    ),
  });

export const createCustomerOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      appUserId: string;
      name?: string;
      email?: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateCustomer(variables))),
    mutationKey: ["createCustomer"],
  });
