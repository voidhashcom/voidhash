import 'server-only';

import { Next } from '@mcrovero/effect-nextjs';
import { BetterAuth } from '@voidhash/auth/effect';
import {
  ApiKeyService,
  CustomerService,
  OrganizationService,
  PaymentProviderProductService,
  PaymentProviderService,
  PerkService,
  ProductService,
  ProjectService,
  SdkService,
  UserService
} from '@voidhash/core/services';
import { Db } from '@voidhash/db/effect';
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

  const ServiceLayer = pipe(
    ApiKeyService.Default,
    Layer.provideMerge(CustomerService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderService.Default),
    Layer.provideMerge(PaymentProviderProductService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default)
  );

  return pipe(ServiceLayer, Layer.provideMerge(CoreLayer));
})();

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
