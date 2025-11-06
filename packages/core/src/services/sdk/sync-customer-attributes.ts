import type { SdkCustomer } from '@voidhash/api-spec';
import { CustomerOrigin } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthenticationError,
  AuthSession,
  SdkServiceError,
  SdkValidationError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import type { CustomerMetadata } from '../../types';
import { CustomerService } from '../customers';
import { _getCustomerByAppUserId, _updateCustomerRecord } from './utils';

type CustomerAttributesParams = {
  name?: string;
  email?: string;
  customerMetadata: CustomerMetadata;
};

export const syncCustomerAttributes = Effect.gen(function* () {
  const db = yield* Db;
  const customerService = yield* CustomerService;
  return Effect.fn('syncCustomerAttributes')(
    function* (input: CustomerAttributesParams) {
      const session = yield* AuthSession;

      const appUserId = session?.customer?.appUserId;
      if (!appUserId) {
        return yield* Effect.fail(
          new SdkValidationError({
            message: 'App user ID not found'
          })
        );
      }

      const projectId = session?.projects[0]?.id;
      if (!projectId) {
        return yield* Effect.fail(
          new AuthenticationError({
            cause:
              'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.',
            message:
              'No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.'
          })
        );
      }

      // Get or create customer
      const customer = yield* pipe(
        _getCustomerByAppUserId(db)({
          appUserId,
          projectId
        }),

        Effect.andThen((customer) => {
          if (customer) {
            return Effect.succeed(customer);
          }

          return pipe(
            customerService.createCustomer({
              projectId,
              appUserId,
              name: null,
              email: null,
              origin: CustomerOrigin.IOS // TODO: Make this dynamic
            }),

            // Get customer after creation
            Effect.andThen(() =>
              _getCustomerByAppUserId(db)({
                appUserId,
                projectId
              })
            ),

            // This is required to make the type checker happy
            Effect.andThen((customer) =>
              customer
                ? Effect.succeed(customer)
                : Effect.dieMessage(
                    'Customer not found after syncCustomerData. This should never happen, because we created it before retrieving it.'
                  )
            )
          );
        })
      );

      yield* _updateCustomerRecord(db)({
        id: customer.id,
        name: input.name,
        email: input.email,
        additionalAttributes: {
          ...(customer.additionalAttributes ?? {}),
          platform: input.customerMetadata.platform,
          sdk: input.customerMetadata.sdk,
          sdkVersion: input.customerMetadata.sdkVersion,
          platformFlavor: input.customerMetadata.platformFlavor,
          platformFlavorVersion: input.customerMetadata.platformFlavorVersion,
          platformVersion: input.customerMetadata.platformVersion,
          platformDevice: input.customerMetadata.platformDevice,
          platformBrand: input.customerMetadata.platformBrand,
          preferredLocales: input.customerMetadata.preferredLocales,
          clientLocale: input.customerMetadata.clientLocale,
          clientVersion: input.customerMetadata.clientVersion,
          storefront: input.customerMetadata.storefront
        }
      });

      return {
        appUserId: customer.appUserId,
        name: customer.name,
        email: customer.email,
        customerId: customer.id
      } satisfies typeof SdkCustomer.Type;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            }),
          CustomerServiceError: (error) =>
            new SdkServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
