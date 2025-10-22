import { CustomerService } from '@voidhash/core/services';
import { CustomerOrigin } from '@voidhash/db';
import { CustomerRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const CustomerRpcsLive = CustomerRpcsDef.toLayer(
  Effect.gen(function* () {
    const customerService = yield* CustomerService;
    return {
      CreateCustomer: ({ appUserId, name, email, projectId }) =>
        Effect.gen(function* () {
          return yield* customerService.createCustomer({
            appUserId,
            projectId,
            origin: CustomerOrigin.API,
            name: name ?? null,
            email: email ?? null
          });
        }),
      ListCustomers: ({ projectId }) =>
        Effect.gen(function* () {
          return yield* customerService.getCustomers({ projectId });
        }),
      GetCustomerById: ({ customerId }) =>
        customerService.getCustomerById(customerId),
      GetCustomerByAppUserId: ({ appUserId, projectId }) =>
        customerService.getCustomerByAppUserId(appUserId, projectId)
    };
  })
).pipe(Layer.provide(CustomerService.Default));
