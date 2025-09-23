import { BetterAuth } from '@voidhash/auth/effect';
import { Db } from '@voidhash/db/effect';
import { Effect, Layer, ManagedRuntime, pipe } from 'effect';
import { Cookies } from '../../../apps/web/lib/effect/cookies';
import { ApiKeyRepository } from './repositories/api-key-repository';
import { CheckoutSessionRepository } from './repositories/checkout-session-repository';
import { CustomerRepository } from './repositories/customer-repository';
import { OrganizationRepository } from './repositories/organization-repository';
import { PaymentProviderConfigurationProductRepository } from './repositories/payment-provider-configuration-product-repository';
import { PaymentProviderConfigurationRepository } from './repositories/payment-provider-repository';
import { PaywallLocationRepository } from './repositories/paywall-location-repository';
import { PaywallRepository } from './repositories/paywall-repository';
import { PerkRepository } from './repositories/perk-repository';
import { ProductPerkRepository } from './repositories/product-perk-repository';
import { ProductRepository } from './repositories/product-repository';
import { ProjectRepository } from './repositories/project-repository';
import { ApiKeyService } from './services/api-key-service';
import { AuthService } from './services/auth-service';
import { CustomerService } from './services/customer-service';
import { EnvironmentService } from './services/environment-service';
import { OrganizationService } from './services/organization-service';
import { PaymentProviderService } from './services/payment-provider-service';
import { PaywallLocationService } from './services/paywall-location-service';
import { PaywallService } from './services/paywall-service';
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
    AuthService.Default,
    Layer.provideMerge(BetterAuth.Default),
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
