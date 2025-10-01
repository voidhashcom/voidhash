import {
  HttpApiBuilder,
  HttpApiError,
  HttpServerResponse
} from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';
import {
  authenticateWithSecretKey,
  CustomerService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect, Layer, pipe } from 'effect';
import { getSecretKeyFromRequest } from '@/utils/auth';
import { HandleCommonErrors, HandleSecretKeyAuthErrors } from '@/utils/errors';

export const CustomersGroupLive = HttpApiBuilder.group(
  VoidhashApi,
  'v1_customers',
  (handlers) =>
    Effect.gen(function* () {
      return handlers.handle('byAppUserId', ({ path: { appUserId } }) =>
        Effect.gen(function* () {
          const secretKey = yield* getSecretKeyFromRequest();
          return yield* authenticateWithSecretKey(secretKey)(
            withEnvironmentFromApiKey()(
              Effect.gen(function* () {
                const customerService = yield* CustomerService;
                const customer =
                  yield* customerService.getCustomerByAppUserId(appUserId);

                return yield* HttpServerResponse.json({
                  customerId: customer.id,
                  name: customer.name ?? null,
                  email: customer.email ?? null,
                  appUserId: customer.appUserId ?? null
                });
              })
            )
          );
        }).pipe(
          Effect.catchTags({
            HttpBodyError: () =>
              Effect.fail(new HttpApiError.InternalServerError())
          }),
          Effect.catchTags(HandleCommonErrors),
          Effect.catchTags(HandleSecretKeyAuthErrors)
        )
      );
    })
).pipe(Layer.provide(pipe(CustomerService.Default)));

// export const CustomersGroupLive = HttpApiBuilder.group(
//   VoidhashApi,
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
