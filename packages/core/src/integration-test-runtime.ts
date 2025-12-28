import { BetterAuth } from '@voidhash/auth/effect';
import { Db } from '@voidhash/db/effect';
import { type Effect, Layer, ManagedRuntime, pipe } from 'effect';
import { BillingService, UsageService } from './services';
import { ApiKeyService } from './services/api-keys';
import { CustomerService } from './services/customers';
import { OrganizationService } from './services/organizations';
import { PaymentProviderConfigurationService } from './services/payment-provider-configurations';
import { PerkService } from './services/perks';
import { ProductService } from './services/products';
import { ProjectService } from './services/projects';
import { SdkService } from './services/sdk';
import { UserService } from './services/users';
import { MockBillingProviderLive } from './testing/__mocks__/billing.mock';

const DbLive = Db.Default;

const RuntimeLayer = () => {
  const CoreLayer = pipe(BetterAuth.Default, Layer.provideMerge(DbLive));

  const ServiceLayer = pipe(
    ApiKeyService.Default,
    Layer.provideMerge(CustomerService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderConfigurationService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default),
    Layer.provideMerge(BillingService.Default),
    Layer.provideMerge(UsageService.Default),
    Layer.provideMerge(MockBillingProviderLive)
  );
  return pipe(ServiceLayer, Layer.provideMerge(CoreLayer));
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
