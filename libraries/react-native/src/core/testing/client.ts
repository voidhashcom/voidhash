// import { VoidhashClient } from '../../client';
// import { CacheManager } from '../caching/cache-manager';
// import type { PlatformInfo } from '../constants';
// import { EventBus } from '../event-bus';
// import { CustomerAttributeManager } from '../identity/customer-attribute-manager';
// import { CustomerInfoManager } from '../identity/customer-info-manager';
// import { IdentityManager } from '../identity/identity-manager';
// import { Logger, LogLevel } from '../logging';
// import { createApi } from '../networking/_/api';
// import { HttpClient } from '../networking/_/http-client';
// import type { PaymentAdapter } from '../payment-adapters/payment-adapter';
// import type { PlatformProvider } from '../platform/types';
// import type { VoidhashSchema } from '../schema';
// import { TestCacheAdapter } from './cache-adapter';
// import { TestPaymentAdapter } from './payment-adapter';
// import { TestPlatformProvider } from './platform-provider';

// type CreateVoidhashTestClientOptions = {
//   initialDistinctId?: string;
//   schema: VoidhashSchema;
//   platformInfo?: Partial<PlatformInfo>;
//   eventBus?: EventBus;
//   platformProvider?: PlatformProvider;
//   cacheManager?: CacheManager;
//   customerInfoManager?: CustomerInfoManager;
//   customerAttributeManager?: CustomerAttributeManager;
//   identityManager?: IdentityManager;
//   paymentAdapter?: PaymentAdapter;
// };

// export function createVoidhashTestClient({
//   initialDistinctId,
//   schema,
//   platformInfo,
//   cacheManager: cacheManagerOverride,
//   eventBus: eventBusOverride,
//   platformProvider: platformProviderOverride,
//   customerInfoManager: customerInfoManagerOverride,
//   customerAttributeManager: customerAttributeManagerOverride,
//   identityManager: identityManagerOverride,
//   paymentAdapter: paymentAdapterOverride
// }: CreateVoidhashTestClientOptions) {
//   const scheme = 'test';
//   const logger = new Logger('VoidhashClient', LogLevel.DEBUG);
//   const eventBus = eventBusOverride ?? new EventBus();
//   const platformProvider =
//     platformProviderOverride ?? new TestPlatformProvider(platformInfo);
//   const cacheManager =
//     cacheManagerOverride ?? new CacheManager(new TestCacheAdapter());
//   const httpClient = new HttpClient({
//     publishableKey: 'test',
//     baseUrl: 'https://api.voidhash.com',
//     platformProvider,
//     logger
//   });
//   const api = createApi(httpClient);
//   const customerInfoManager =
//     customerInfoManagerOverride ??
//     new CustomerInfoManager(cacheManager, logger, api, eventBus);
//   const customerAttributeManager =
//     customerAttributeManagerOverride ??
//     new CustomerAttributeManager(cacheManager, logger, api);
//   const identityManager =
//     identityManagerOverride ??
//     new IdentityManager(
//       cacheManager,
//       logger,
//       customerInfoManager,
//       customerAttributeManager,
//       api,
//       eventBus
//     );
//   const paymentAdapter = paymentAdapterOverride ?? new TestPaymentAdapter();
//   const voidhashClient = new VoidhashClient(
//     initialDistinctId ?? null,
//     scheme,
//     logger,
//     cacheManager,
//     customerInfoManager,
//     identityManager,
//     customerAttributeManager,
//     schema,
//     paymentAdapter,
//     eventBus,
//     platformProvider,
//     httpClient
//   );
//   return voidhashClient;
// }
