import { Context, Data, Effect, Layer, ManagedRuntime, pipe } from 'effect';
import type { z } from 'zod';
import type { ErrorCode } from '@/lib/api/errors/http';
import { DevCheckoutService } from '@/lib/payment-providers/dev-checkout/dev-checkout.service';
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
import { EnvironmentService } from '@/lib/services/environment.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { PaywallLocationService } from '@/lib/services/paywall-location.service';
import { PerkService } from '@/lib/services/perk.service';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';
import { SdkService } from '@/lib/services/sdk.service';
import { UserService } from '@/lib/services/user.service';
import type { Context as HonoContextType } from '../../api/hono/app';
import { AuthService } from '../../services/auth.service';
import { BetterAuth } from '../better-auth';
import { Cookies } from '../cookies';
import { Db } from '../db';
import { Request } from '../request';
import { HonoRuntimeTag, NextjsRuntimeTag } from './tags';

export class HonoContext extends Context.Tag('app/HonoContext')<
  HonoContext,
  HonoContextType
>() {}

type RuntimeType = 'nexjts' | 'hono';

const HonoRuntimeTagLive = Layer.succeed(
  HonoRuntimeTag,
  HonoRuntimeTag.of('hono')
);

const NextjsRuntimeTagLive = Layer.succeed(
  NextjsRuntimeTag,
  NextjsRuntimeTag.of('nextjs')
);

const CookiesLive = Layer.effect(
  Cookies,
  Effect.gen(function* () {
    const mockCookies = new Map<string, string>();

    return {
      getCookie: (name) => Effect.succeed(mockCookies.get(name) ?? null),
      setCookie: (name, value) => Effect.succeed(mockCookies.set(name, value)),
      deleteCookie: (name) => Effect.succeed(mockCookies.delete(name))
    };
  })
);

const RequestLive = Layer.effect(
  Request,
  Effect.gen(function* () {
    return {
      getSource: () =>
        Effect.succeed('api-server' as 'nextjs' | 'api-server' | 'api-sdk'),
      getHeaders: () => Effect.succeed(new Headers())
    };
  })
);

const DbLive = Db.Default;

const RuntimeLayer = (type: RuntimeType) => {
  const tag =
    type === 'hono'
      ? Layer.provideMerge(HonoRuntimeTagLive)
      : Layer.provideMerge(NextjsRuntimeTagLive);
  const CoreLayer = pipe(
    AuthService.Default,
    Layer.provideMerge(BetterAuth.Default),
    Layer.provideMerge(DbLive),
    Layer.provideMerge(CookiesLive),
    Layer.provideMerge(RequestLive),
    tag
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
    Layer.provideMerge(EnvironmentService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderService.Default),
    Layer.provideMerge(PaywallLocationService.Default),
    Layer.provideMerge(PaywallService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default),
    Layer.provideMerge(DevCheckoutService.Default)
  );

  return pipe(
    ServiceLayer,
    Layer.provideMerge(RepositoryLayer),
    Layer.provideMerge(CoreLayer)
  );
};

export const createIntegrationTestRuntime = (type: RuntimeType) =>
  ManagedRuntime.make(RuntimeLayer(type));

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

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createIntegrationTestRunner =
  (type: RuntimeType) =>
  async <T, C extends AvailableServices>(
    // biome-ignore lint/suspicious/noExplicitAny: is ok
    effect: Effect.Effect<T, any, C>
  ) => {
    const runtime = createIntegrationTestRuntime(type);
    return await runtime.runPromiseExit(pipe(effect));
  };
