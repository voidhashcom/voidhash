import { BetterAuth } from '@voidhash/auth/effect';
import { Db } from '@voidhash/db/effect';
import { Effect, Layer, ManagedRuntime, pipe } from 'effect';
import { Cookies } from '../../../apps/web/lib/effect/cookies';
import { ApiKeyService } from './services/api-key-service';
import { CustomerService } from './services/customer-service';
import { OrganizationService } from './services/organization-service';
import { PaymentProviderConfigurationService } from './services/payment-provider-configuration-service';
import { PerkService } from './services/perk-service';
import { ProductService } from './services/product-service';
import { ProjectService } from './services/project-service';
import { SdkService } from './services/sdk-service';
import { UserService } from './services/user-service';

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

const DbLive = Db.Default;

const RuntimeLayer = () => {
  const CoreLayer = pipe(
    BetterAuth.Default,
    Layer.provideMerge(DbLive),
    Layer.provideMerge(CookiesLive)
  );

  const ServiceLayer = pipe(
    ApiKeyService.Default,
    Layer.provideMerge(CustomerService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderConfigurationService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default)
  );

  return pipe(
    ServiceLayer,

    Layer.provideMerge(CoreLayer)
  );
};

export const createIntegrationTestRuntime = () =>
  ManagedRuntime.make(RuntimeLayer());

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createIntegrationTestRunner =
  () =>
  async <T, C extends AvailableServices>(
    // biome-ignore lint/suspicious/noExplicitAny: is ok
    effect: Effect.Effect<T, any, C>
  ) => {
    const runtime = createIntegrationTestRuntime();
    return await runtime.runPromiseExit(pipe(effect));
  };
