import { CustomerService } from "@voidhash/core/services";
import { CustomerOrigin } from "@voidhash/db";
import { CustomerRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const CustomerRpcsLive = CustomerRpcsDef.toLayer(
  Effect.gen(function* CustomerRpcsLive() {
    const customerService = yield* CustomerService;
    return {
      CreateCustomer: ({ appUserId, name, email, projectId }) =>
        Effect.gen(function* CreateCustomer() {
          return yield* customerService.createCustomer({
            appUserId,
            email: email ?? null,
            name: name ?? null,
            origin: CustomerOrigin.API,
            projectId,
          });
        }),
      GetCustomerByAppUserId: ({ appUserId, projectId }) =>
        customerService.getCustomerByAppUserId(appUserId, projectId),
      GetCustomerById: ({ customerId }) =>
        customerService.getCustomerById(customerId),
      ListCustomers: ({ projectId }) =>
        Effect.gen(function* ListCustomers() {
          return yield* customerService.getCustomers({ projectId });
        }),
    };
  })
).pipe(Layer.provide(CustomerService.Default));
