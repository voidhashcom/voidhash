import 'server-only';

import { Next } from '@mcrovero/effect-nextjs';
import { Effect, Layer, pipe, Schema } from 'effect';
import { cookies, headers } from 'next/headers';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { ApiKeyRepository } from '@/lib/repositories/api-key.repository';
import { CheckoutSessionRepository } from '@/lib/repositories/checkout-session.repository';
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { OrganizationRepository } from '@/lib/repositories/organization.repository';
import { PaymentProviderConfigurationRepository } from '@/lib/repositories/payment-provider.repository';
import { PaymentProviderConfigurationProductRepository } from '@/lib/repositories/payment-provider-configuration-product.repository';
import { PaywallRepository } from '@/lib/repositories/paywall.repository';
import { PaywallLocationRepository } from '@/lib/repositories/paywall-location.repository';
import { PerkRepository } from '@/lib/repositories/perk.repository';
import { ProductRepository } from '@/lib/repositories/product.repository';
import { ProductPerkRepository } from '@/lib/repositories/product-perk.repository';
import { ProjectRepository } from '@/lib/repositories/project.repository';
import { ApiKeyService } from '@/lib/services/api-key.service';
import { CustomerService } from '@/lib/services/customer.service';
import {
  type EnvironmentCookieNotFoundError,
  EnvironmentService,
  type InvalidEnvironmentError,
  type OrganizationNotFoundInSessionError,
  type ProjectNotFoundInSessionError
} from '@/lib/services/environment.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { PaywallLocationService } from '@/lib/services/paywall-location.service';
import { PerkService } from '@/lib/services/perk.service';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';
import { SdkService } from '@/lib/services/sdk.service';
import { UserService } from '@/lib/services/user.service';
import {
  AuthService,
  type InvalidPublishableKeyError,
  type InvalidSecretKeyError,
  type InvalidSourceError,
  type MissingAppUserIdError,
  type MissingProjectIdError,
  type MissingPublishableKeyError,
  type MissingSecretKeyError
} from '../../services/auth.service';
import type { MissingEnvironmentError } from '../../services/environment.service';
import { BetterAuth, type BetterAuthError } from '../better-auth';
import { Cookies, CookiesError } from '../cookies';
import { type DatabaseError, Db } from '../db';
import type {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../errors';
import { Request } from '../request';
import { NextjsRuntimeTag } from './tags';

export class NextjsErrorResponse extends Schema.TaggedError<NextjsErrorResponse>()(
  'NextjsErrorResponse',
  {
    code: Schema.String,
    message: Schema.String
  }
) {}

export function encodeNextjsErrorResponse(error: NextjsErrorResponse) {
  return {
    code: error.code,
    message: error.message
  };
}

const NextjsRuntimeTagLive = Layer.succeed(
  NextjsRuntimeTag,
  NextjsRuntimeTag.of('nextjs')
);

const CookiesLive = Layer.succeed(
  Cookies,
  Cookies.of({
    getCookie: (name) =>
      Effect.tryPromise({
        try: async () => (await cookies()).get(name)?.value ?? null,
        catch: (error) =>
          new CookiesError({ message: 'Failed to get cookie', cause: error })
      }),
    setCookie: (name, value) =>
      Effect.tryPromise({
        try: async () => (await cookies()).set(name, value),
        catch: (error) =>
          new CookiesError({ message: 'Failed to set cookie', cause: error })
      }),
    deleteCookie: (name) =>
      Effect.tryPromise({
        try: async () => (await cookies()).delete(name),
        catch: (error) =>
          new CookiesError({
            message: 'Failed to delete cookie',
            cause: error
          })
      })
  })
);

const RequestLive = Layer.succeed(
  Request,
  Request.of({
    getSource: () => Effect.succeed('nextjs'),
    getHeaders: () => Effect.promise(async () => new Headers(await headers()))
  })
);

const DbLive = Db.Default;

const InternalsLayer = (() => {
  const CoreLayer = pipe(
    BetterAuth.Default,
    Layer.provideMerge(DbLive),
    Layer.provideMerge(CookiesLive),
    Layer.provideMerge(RequestLive),
    Layer.provideMerge(NextjsRuntimeTagLive)
  );

  const RepositoryLayer = pipe(
    ApiKeyRepository.Default,
    Layer.provideMerge(CustomerRepository.Default),
    Layer.provideMerge(CheckoutSessionRepository.Default),
    Layer.provideMerge(OrganizationRepository.Default),
    Layer.provideMerge(PaymentProviderConfigurationProductRepository.Default),
    Layer.provideMerge(PaymentProviderConfigurationRepository.Default),
    Layer.provideMerge(PaywallLocationRepository.Default),
    Layer.provideMerge(PaywallRepository.Default),
    Layer.provideMerge(PerkRepository.Default),
    Layer.provideMerge(ProductPerkRepository.Default),
    Layer.provideMerge(ProductRepository.Default),
    Layer.provideMerge(ProjectRepository.Default)
  );

  const ServiceLayer = pipe(
    ApiKeyService.Default,
    Layer.provideMerge(AuthService.Default),
    Layer.provideMerge(CustomerService.Default),
    Layer.provideMerge(EnvironmentService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderService.Default),
    Layer.provideMerge(PaywallLocationService.Default),
    Layer.provideMerge(PaywallService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default)
  );

  return pipe(
    ServiceLayer,
    Layer.provideMerge(RepositoryLayer),
    Layer.provideMerge(CoreLayer)
  );
})();

type GenericErrors = NotFoundError | ForbiddenError | UnauthorizedError;
type SystemErrors =
  | CookiesError
  | DatabaseError
  | BetterAuthError
  | InvalidSourceError;
type AcceptableErrorTypes =
  | GenericErrors
  | SystemErrors
  | MissingSecretKeyError
  | MissingPublishableKeyError
  | InvalidSecretKeyError
  | InvalidPublishableKeyError
  | MissingAppUserIdError
  | MissingEnvironmentError
  | MissingProjectIdError
  | ProjectNotFoundInSessionError
  | OrganizationNotFoundInSessionError
  | InvalidEnvironmentError
  | EnvironmentCookieNotFoundError;

export const HandleCommonErrors = <D, T>(
  effect: Effect.Effect<D, AcceptableErrorTypes, T>
) => {
  return pipe(
    effect,
    Effect.catchTags({
      NotFoundError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'NOT_FOUND',
            message: error.message
          })
        ),
      ForbiddenError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'FORBIDDEN',
            message: error.message
          })
        ),
      UnauthorizedError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message
          })
        ),
      CookiesError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      DatabaseError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      BetterAuthError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      InvalidSourceError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      MissingEnvironmentError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      MissingSecretKeyError: () =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Missing secret key error occured in nextjs runtime'
          })
        ),
      MissingPublishableKeyError: () =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Missing secret key error occured in nextjs runtime'
          })
        ),
      InvalidSecretKeyError: () =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Invalid secret key error occured in nextjs runtime'
          })
        ),
      InvalidPublishableKeyError: () =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Invalid publishable key error occured in nextjs runtime'
          })
        ),
      MissingAppUserIdError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message
          })
        ),
      MissingProjectIdError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      ProjectNotFoundInSessionError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      InvalidEnvironmentError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      EnvironmentCookieNotFoundError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        ),
      OrganizationNotFoundInSessionError: (error) =>
        Effect.fail(
          new NextjsErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        )
    })
  );
};

export const ErrorAsComponent = <D, T>(
  effect: Effect.Effect<D, NextjsErrorResponse, T>
) => {
  return pipe(
    effect,
    Effect.catchTag('NextjsErrorResponse', (error) =>
      Effect.succeed(
        <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />
      )
    )
  );
};

// @mcrovero/effect-nextjs

export const Page = Next.make('EffectfulBasePage', InternalsLayer);
export const ServerComponent = Next.make(
  'EffectfulServerComponent',
  InternalsLayer
);
export const ServerAction = Next.make('EffectfulServerAction', InternalsLayer);
