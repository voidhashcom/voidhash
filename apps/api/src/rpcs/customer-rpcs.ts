import { CustomerService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { CustomerOrigin } from '@voidhash/db';
import { CustomerRpcsDef } from '@voidhash/rpc';
import { AuthSession } from '@voidhash/shared';
import { Effect, Layer } from 'effect';

export const CustomerRpcsLive = CustomerRpcsDef.toLayer(
  Effect.gen(function* () {
    const customerService = yield* CustomerService;
    return {
      CreateCustomer: ({ appUserId, name, email }) =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* customerService.createCustomer({
            appUserId,
            projectId,
            origin: CustomerOrigin.API,
            name: name ?? null,
            email: email ?? null
          });
        }),
      ListCustomers: () =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* customerService.getCustomers({ projectId });
        }),
      GetCustomerById: ({ customerId }) =>
        customerService.getCustomerById(customerId),
      GetCustomerByAppUserId: ({ appUserId }) =>
        customerService.getCustomerByAppUserId(appUserId)
    };
  })
).pipe(Layer.provide(CustomerService.Default));
