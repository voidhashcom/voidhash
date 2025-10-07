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
  type InvalidEnvironmentError,
  type InvalidPublishableKeyError,
  type InvalidSecretKeyError,
  type InvalidSourceError,
  type MissingEnvironmentError,
  type MissingProjectIdError,
  type OrganizationNotFoundInSessionError,
  OrganizationService,
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
import type {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '@voidhash/lib';
import {
  Context,
  Data,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  pipe
} from 'effect';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { z } from 'zod';
import { AppStoreProviderLayer } from '../../../../packages/core/src/payment-providers/app-store/layer.js';
import { Cookies, CookiesError } from '../../../web/lib/effect/cookies.js';
import { type ErrorCode, errorResponse } from '../errors/http.ts';
import type { Context as HonoContextType } from '../hono/app.ts';

export class HonoContext extends Context.Tag('app/HonoContext')<
  HonoContext,
  HonoContextType
>() {}

const CookiesLive = Layer.effect(
  Cookies,
  Effect.gen(function* () {
    return {
      getCookie: (name) =>
        Effect.gen(function* () {
          const honoContext = yield* Effect.serviceOption(HonoContext);
          if (Option.isNone(honoContext)) {
            return yield* Effect.fail(
              new CookiesError({
                message: 'Hono context not found'
              })
            );
          }
          return getCookie(honoContext.value, name) ?? null;
        }),
      setCookie: (name, value) =>
        Effect.gen(function* () {
          const honoContext = yield* Effect.serviceOption(HonoContext);
          if (Option.isNone(honoContext)) {
            return yield* Effect.fail(
              new CookiesError({
                message: 'Hono context not found'
              })
            );
          }
          setCookie(honoContext.value, name, value);
          return;
        }),
      deleteCookie: (name) =>
        Effect.gen(function* () {
          const honoContext = yield* Effect.serviceOption(HonoContext);
          if (Option.isNone(honoContext)) {
            return yield* Effect.fail(
              new CookiesError({
                message: 'Hono context not found'
              })
            );
          }
          deleteCookie(honoContext.value, name);
          return;
        })
    };
  })
);

const DbLive = Db.Default;

const RuntimeLayer = (context: HonoContextType) => {
  const CoreLayer = pipe(
    AuthService.Default,
    Layer.provideMerge(BetterAuth.Default),
    Layer.provideMerge(DbLive),
    Layer.provideMerge(CookiesLive),
    Layer.provideMerge(Layer.succeed(HonoContext, context))
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
    Layer.provideMerge(CustomerService.Default),
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
    AppStoreProviderLayer,
    Layer.provideMerge(ServiceLayer),
    Layer.provideMerge(RepositoryLayer),
    Layer.provideMerge(CoreLayer)
  );
};

export const createHonoRuntime = (context: HonoContextType) =>
  ManagedRuntime.make(RuntimeLayer(context));

export class HonoErrorResponse extends Data.TaggedError('HonoErrorResponse')<{
  code: z.infer<typeof ErrorCode>;
  message: string;
  originalError?: Error;
}> {}

// export const createEffectHandler = (context: HonoContextType) => <T, S>(effect: Effect.Effect<T, HonoErrorResponse, S>):  => {

// 		const runtime = createHonoRuntime(context);
// 		const result = yield* runtime.runPromise(effect);
// 		if (result.isErr()) {
// 			return result.error;
// 		}
// 		return result.value;

// };

type GenericErrors = NotFoundError | ForbiddenError | UnauthorizedError;
type SystemErrors =
  | CookiesError
  | DatabaseError
  | BetterAuthError
  | InvalidSourceError;
type AcceptableErrorTypes =
  | HonoErrorResponse
  | GenericErrors
  | SystemErrors
  | MissingSecretKeyError
  | MissingPublishableKeyError
  | InvalidSecretKeyError
  | InvalidPublishableKeyError
  | MissingEnvironmentError
  | MissingProjectIdError
  | ProjectNotFoundInSessionError
  | OrganizationNotFoundInSessionError
  | InvalidEnvironmentError;

const handleGlobalErrors = (
  // biome-ignore lint/suspicious/noExplicitAny: should be ok
  effect: Effect.Effect<any, AcceptableErrorTypes, any>
  // biome-ignore lint/suspicious/noExplicitAny: should be ok
): Effect.Effect<any, HonoErrorResponse, any> => {
  return pipe(
    effect,
    Effect.catchTags({
      NotFoundError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'NOT_FOUND',
            message: error.message,
            originalError: error
          })
        ),
      ForbiddenError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'FORBIDDEN',
            message: error.message,
            originalError: error
          })
        ),
      UnauthorizedError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message,
            originalError: error
          })
        ),
      CookiesError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      DatabaseError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      BetterAuthError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      InvalidSourceError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      MissingEnvironmentError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      MissingSecretKeyError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message,
            originalError: error
          })
        ),
      MissingPublishableKeyError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message,
            originalError: error
          })
        ),
      InvalidSecretKeyError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message,
            originalError: error
          })
        ),
      InvalidPublishableKeyError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'UNAUTHORIZED',
            message: error.message,
            originalError: error
          })
        ),
      MissingProjectIdError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      ProjectNotFoundInSessionError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      OrganizationNotFoundInSessionError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        ),
      InvalidEnvironmentError: (error) =>
        Effect.fail(
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            originalError: error
          })
        )
    })
  );
};

const toHonoErrorResponse = (c: HonoContextType, error: HonoErrorResponse) => {
  return errorResponse(c, error.code, error.message);
};

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createEffectHandler =
  (context: HonoContextType) =>
  async <T, E extends AcceptableErrorTypes, C extends AvailableServices>(
    effect: Effect.Effect<T, E, C>
  ) => {
    const runtime = createHonoRuntime(context);
    const result = await runtime.runPromiseExit(
      pipe(
        effect,
        handleGlobalErrors,
        // biome-ignore lint/suspicious/noExplicitAny: required for the instanceof check
        Effect.catchAll((error: any) => {
          const honoErrorResponse =
            error instanceof HonoErrorResponse
              ? error
              : new HonoErrorResponse({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Internal server error',
                  originalError: error
                });

          context.get('logger').error('HonoErrorResponse', {
            error: error.message,
            cause: error.originalError
          });

          return Effect.succeed(
            toHonoErrorResponse(context, honoErrorResponse)
          );
        })
      )
    );

    return Exit.match(result, {
      onSuccess: (value) => value,
      onFailure: () => {
        return toHonoErrorResponse(
          context,
          new HonoErrorResponse({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error'
          })
        );
      }
    });
  };
