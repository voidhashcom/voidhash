import { HttpApiBuilder, HttpServerRequest } from '@effect/platform';
import { SdkHeaders, VoidhashV1Api } from '@voidhash/api-spec';
import { SdkService } from '@voidhash/core/services';
import { SdkValidationError } from '@voidhash/shared';
import { Effect, Schema } from 'effect';
import { getCustomerMetadataFromSdkHeaders } from '@/utils/sdk-headers';

export const SdkGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'sdk',
  (handlers) =>
    Effect.gen(function* () {
      const sdkService = yield* SdkService;
      return handlers
        .handle('getCustomer', () => sdkService.getCustomer())
        .handle('identify', ({ payload }) =>
          sdkService.identifyCustomer({
            appUserId: payload.appUserId,
            name: payload.name ?? null,
            email: payload.email ?? null
          })
        )
        .handle('syncCustomerAttributes', ({ payload }) =>
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedHeaders = yield* Schema.decodeUnknown(SdkHeaders)(
              req.headers
            ).pipe(
              Effect.catchTags({
                ParseError: (error) =>
                  Effect.fail(
                    new SdkValidationError({
                      message: error.message
                    })
                  )
              })
            );
            const customerMetadata =
              getCustomerMetadataFromSdkHeaders(parsedHeaders);

            return yield* sdkService.syncCustomerAttributes({
              name: payload.name,
              email: payload.email,
              customerMetadata
            });
          })
        );
    })
);
