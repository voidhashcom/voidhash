import 'server-only';

import { Next } from '@mcrovero/effect-nextjs';
import { BetterAuth, type BetterAuthError } from '@voidhash/auth/effect';
import {
  ApiKeyRepository,
  CheckoutSessionRepository,
  CustomerRepository,
  OrganizationRepository,
  PaymentProviderConfigurationProductRepository,
  PaymentProviderConfigurationRepository,
  PaywallLocationRepository,
  PaywallRepository,
  PerkRepository,
  ProductPerkRepository,
  ProductRepository,
  ProjectRepository
} from '@voidhash/core/repositories';
import {
  ApiKeyService,
  AuthService,
  CustomerService,
  type EnvironmentCookieNotFoundError,
  EnvironmentService,
  type InvalidEnvironmentError,
  type InvalidPublishableKeyError,
  type InvalidSecretKeyError,
  type InvalidSourceError,
  type MissingEnvironmentError,
  type MissingProjectIdError,
  type OrganizationNotFoundInSessionError,
  OrganizationService,
  PaymentProviderProductService,
  PaymentProviderService,
  PaywallLocationService,
  PaywallService,
  PerkService,
  ProductService,
  type ProjectNotFoundInSessionError,
  ProjectService,
  SdkService,
  UserService
} from '@voidhash/core/services';
import { type DatabaseError, Db } from '@voidhash/db/effect';
import { Effect, Layer, pipe, Schema } from 'effect';
import { cookies } from 'next/headers';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { Cookies, CookiesError } from './effect/cookies';

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

const DbLive = Db.Default;

const InternalsLayer = (() => {
  const CoreLayer = pipe(
    BetterAuth.Default,
    Layer.provideMerge(DbLive),
    Layer.provideMerge(CookiesLive)
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
    Layer.provideMerge(PaymentProviderProductService.Default),
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

type SystemErrors =
  | CookiesError
  | DatabaseError
  | BetterAuthError
  | InvalidSourceError;
type AcceptableErrorTypes =
  | SystemErrors
  | InvalidSecretKeyError
  | InvalidPublishableKeyError
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
export const ServerRoute = Next.make('EffectfulServerRoute', InternalsLayer);
