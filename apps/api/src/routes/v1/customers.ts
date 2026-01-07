import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { CustomerService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { CustomerOrigin } from "@voidhash/db";
import { AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

export const CustomersGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "customers",
  (handlers) =>
    Effect.gen(function* CustomersGroupLive() {
      const customerService = yield* CustomerService;
      return handlers
        .handle("createCustomer", ({ payload }) =>
          Effect.gen(function* CustomersGroupLive() {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* customerService.createCustomer({
              ...payload,
              projectId,
              origin: CustomerOrigin.API,
              name: payload.name ?? null,
              email: payload.email ?? null,
            });
          })
        )
        .handle("listCustomers", () =>
          Effect.gen(function* CustomersGroupLive() {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* customerService.getCustomers({ projectId });
          })
        )
        .handle("getCustomerById", ({ path: { customerId } }) =>
          customerService.getCustomerById(customerId)
        )
        .handle("byAppUserId", ({ path: { appUserId } }) =>
          Effect.gen(function* CustomersGroupLive() {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* customerService.getCustomerByAppUserId(
              appUserId,
              projectId
            );
          })
        );
    })
);

// export const CustomersGroupLive = HttpApiBuilder.group(
//   VoidhashV1Api,
//   'v1/customers',
//   (handlers) =>
//     Effect.gen(function* () {
//       return handlers.handle('by-app-user-id', ({ path: { appUserId } }) =>
//         Effect.gen(function* () {
//           yield* Effect.log(appUserId);
//           return yield* HttpServerResponse.json({
//             customerId: 'placeholder',
//             name: null,
//             email: null,
//             appUserId: null
//           }).pipe(
//             Effect.catchTag('HttpBodyError', () =>
//               Effect.fail(new HttpApiError.BadRequest())
//             )
//           );
//         })
//       );
//     })
// );
