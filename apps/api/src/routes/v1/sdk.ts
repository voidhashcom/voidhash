import {
  HttpApiBuilder,
  HttpApiError,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform';
import { SdkHeaders, VoidhashApi } from '@voidhash/api-spec';
import { CustomerRepository } from '@voidhash/core/repositories';
import {
  authenticateWithPublishableKey,
  CustomerNotFoundError,
  CustomerService,
  SdkService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect, Layer, Schema } from 'effect';
import {
  getAppUserIdFromRequest,
  getPublishableKeyFromRequest
} from '@/utils/auth';
import {
  HandleCommonErrors,
  HandlePublishableKeyAuthErrors
} from '@/utils/errors';
import { getCustomerMetadataFromSdkHeaders } from '@/utils/sdk-headers';

export const SdkGroupLive = HttpApiBuilder.group(
  VoidhashApi,
  'v1_sdk',
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle('getCustomer', () =>
          Effect.gen(function* () {
            const publishableKey = yield* getPublishableKeyFromRequest();
            const appUserId = yield* getAppUserIdFromRequest();
            return yield* authenticateWithPublishableKey(
              publishableKey,
              appUserId
            )(
              withEnvironmentFromApiKey()(
                Effect.gen(function* () {
                  const sdkService = yield* SdkService;
                  const customer = yield* sdkService.getCustomer();

                  if (!customer) {
                    return yield* Effect.fail(
                      new CustomerNotFoundError({
                        message: 'Customer not found'
                      })
                    );
                  }

                  return yield* HttpServerResponse.json({
                    customerId: customer.id,
                    name: customer.name ?? null,
                    email: customer.email,
                    appUserId: customer.appUserId ?? null
                  });
                })
              )
            );
          }).pipe(
            Effect.catchTags(HandleCommonErrors),
            Effect.catchTags(HandlePublishableKeyAuthErrors),
            Effect.catchTags({
              HttpBodyError: () =>
                Effect.fail(new HttpApiError.InternalServerError())
            })
          )
        )
        .handle('identify', ({ payload }) =>
          Effect.gen(function* () {
            const publishableKey = yield* getPublishableKeyFromRequest();
            const appUserId = yield* getAppUserIdFromRequest();
            return yield* authenticateWithPublishableKey(
              publishableKey,
              appUserId
            )(
              withEnvironmentFromApiKey()(
                Effect.gen(function* () {
                  const sdkService = yield* SdkService;
                  // Implementation for identifying customer
                  const customer = yield* sdkService.identifyCustomer({
                    appUserId: payload.appUserId,
                    name: payload.name ?? null,
                    email: payload.email ?? null
                  });

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
            Effect.catchTags(HandleCommonErrors),
            Effect.catchTags(HandlePublishableKeyAuthErrors),
            Effect.catchTags({
              HttpBodyError: () =>
                Effect.fail(new HttpApiError.InternalServerError())
            })
          )
        )
        .handle('syncCustomerAttributes', ({ payload }) =>
          Effect.gen(function* () {
            const publishableKey = yield* getPublishableKeyFromRequest();
            const appUserId = yield* getAppUserIdFromRequest();
            return yield* authenticateWithPublishableKey(
              publishableKey,
              appUserId
            )(
              withEnvironmentFromApiKey()(
                Effect.gen(function* () {
                  const sdkService = yield* SdkService;

                  const req = yield* HttpServerRequest.HttpServerRequest;
                  const parsedHeaders = yield* Schema.decodeUnknown(SdkHeaders)(
                    req.headers
                  );
                  const customerMetadata =
                    getCustomerMetadataFromSdkHeaders(parsedHeaders);

                  const customer = yield* sdkService.syncCustomerAttributes({
                    name: payload.name,
                    email: payload.email,
                    customerMetadata
                  });

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
            Effect.catchTags(HandleCommonErrors),
            Effect.catchTags(HandlePublishableKeyAuthErrors),
            Effect.catchTags({
              HttpBodyError: () =>
                Effect.fail(new HttpApiError.InternalServerError()),
              ParseError: () => Effect.fail(new HttpApiError.BadRequest())
            })
          )
        );
    })
).pipe(
  Layer.provide(SdkService.Default),
  Layer.provide(CustomerService.Default),
  Layer.provide(CustomerRepository.Default)
);
