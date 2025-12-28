import {
  HttpApiBuilder,
  HttpApiScalar,
  HttpLayerRouter,
  HttpServerResponse
} from '@effect/platform';
import { RpcSerialization, RpcServer } from '@effect/rpc';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { BetterAuth } from '@voidhash/auth/effect';
import {
  ApiKeyService,
  AppStoreServerAPIService,
  AppStoreService,
  CustomerService,
  OrganizationService,
  PaymentProviderConfigurationService,
  PaymentProviderProductService,
  PaywallService,
  PerkGrantService,
  PerkService,
  ProductPerkService,
  ProductService,
  ProjectService,
  SdkService,
  UserService
} from '@voidhash/core/services';
import { Db } from '@voidhash/db/effect';
import { DOCS_DOMAIN, STUDIO_DOMAIN, WWW_DOMAIN } from '@voidhash/lib';
import { RpcGroups } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';
import { AuthMiddlewareLive } from './api-middlewares';
import { JwtAuth } from './jwt-auth';
import { MimicPaywallRouteLayer } from './routes/mimic-paywall';
import { ApiKeysGroupLive } from './routes/v1/api-keys';
import { AuthGroupLive } from './routes/v1/auth';
import { CustomersGroupLive } from './routes/v1/customers';
import { OrganizationsGroupLive } from './routes/v1/organizations';
import { PerksGroupLive } from './routes/v1/perks';
import { ProductPerksGroupLive } from './routes/v1/product-perks';
import { ProductsGroupLive } from './routes/v1/products';
import { ProjectsGroupLive } from './routes/v1/projects';
import { SdkGroupLive } from './routes/v1/sdk';
import { UsersGroupLive } from './routes/v1/users';
import { YjsRouteLayer } from './routes/yjs';
import { RpcAuthLive } from './rpc-middlewares';
import { ApiKeyRpcsLive } from './rpcs/api-key-rpcs';
import { CustomerRpcsLive } from './rpcs/customer-rpcs';
import { OrganizationRpcsLive } from './rpcs/organization-rpcs';
import { PaymentProviderConfigurationRpcsLive } from './rpcs/payment-provider-configuration-rpcs';
import { PaymentProviderProductRpcsLive } from './rpcs/payment-provider-product-rpcs';
import { PaywallRpcsLive } from './rpcs/paywall-rpcs';
import { PerkRpcsLive } from './rpcs/perk-rpcs';
import { ProductPerkRpcsLive } from './rpcs/product-perk-rpcs';
import { ProductRpcsLive } from './rpcs/product-rpcs';
import { ProjectRpcsLive } from './rpcs/project-rpcs';
import { UserRpcsLive } from './rpcs/user-rpcs';
import { BillingRpcsLive } from './rpcs/billing-rpcs';
import { PolarWebhookRouteLayer } from './routes/webhooks/polar';

const ServicesLayer = Layer.mergeAll(
  ApiKeyService.Default,
  AppStoreServerAPIService.Default,
  AppStoreService.Default,
  CustomerService.Default,
  OrganizationService.Default,
  PaymentProviderProductService.Default,
  PaymentProviderConfigurationService.Default,
  PerkGrantService.Default,
  PerkService.Default,
  ProductPerkService.Default,
  PaywallService.Default,
  ProductService.Default,
  ProjectService.Default,
  SdkService.Default,
  UserService.Default
);

// ==============================
// API ROUTES
// ==============================
const V1GroupsLayer = Layer.mergeAll(
  ApiKeysGroupLive,
  AuthGroupLive,
  CustomersGroupLive,
  OrganizationsGroupLive,
  PerksGroupLive,
  ProductPerksGroupLive,
  ProductsGroupLive,
  ProjectsGroupLive,
  SdkGroupLive,
  UsersGroupLive
);

const V1ApiRoutes = HttpLayerRouter.addHttpApi(VoidhashV1Api, {
  openapiPath: '/api/docs/openapi.json'
}).pipe(
  Layer.provide(V1GroupsLayer),
  Layer.provide(Layer.mergeAll(AuthMiddlewareLive, ServicesLayer)),
  Layer.provide(Layer.mergeAll(BetterAuth.Default, Db.Default))
);

// const DocsRoute = HttpApiScalar.layer({
//   path: '/api/docs'
// }).pipe(Layer.provide(V1ApiRoutes));

const ApiDocsLayer = HttpApiScalar.layerHttpLayerRouter({
  api: VoidhashV1Api,
  path: '/api/docs'
});

const ApiRoutesLayer = Layer.mergeAll(
  V1ApiRoutes,
  HttpApiBuilder.middlewareCors({
    allowedOrigins: [WWW_DOMAIN, STUDIO_DOMAIN, DOCS_DOMAIN],
    credentials: true
  })
);

// ==============================
// RPC
// ==============================
const RpcRoutesLayer = RpcServer.layerHttpRouter({
  group: RpcGroups,
  protocol: 'http',
  path: '/rpc'
}).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(RpcAuthLive),
  Layer.provide(
    Layer.mergeAll(
      ApiKeyRpcsLive,
      BillingRpcsLive,
      CustomerRpcsLive,
      OrganizationRpcsLive,
      PaymentProviderConfigurationRpcsLive,
      PaymentProviderProductRpcsLive,
      PerkRpcsLive,
      ProductPerkRpcsLive,
      ProductRpcsLive,
      ProjectRpcsLive,
      PaywallRpcsLive,
      UserRpcsLive
    )
  ),
  Layer.provide(Layer.mergeAll(AuthMiddlewareLive, ServicesLayer)),
  Layer.provide(Layer.mergeAll(BetterAuth.Default, Db.Default, JwtAuth.Default))
);

// ==============================
// Health Check
// ==============================
const HealthCheckRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    // First, we need to access the `HttpRouter` service
    const router = yield* HttpLayerRouter.HttpRouter;

    // Then, we can add a new route to the router
    yield* router.add('GET', '/health', HttpServerResponse.text('OK'));
  })
);

// ==============================
// All Routes
// ==============================
const AllRoutes = Layer.mergeAll(
  ApiRoutesLayer,
  ApiDocsLayer,
  RpcRoutesLayer,
  HealthCheckRoute,
  YjsRouteLayer,
  MimicPaywallRouteLayer,
  PolarWebhookRouteLayer
).pipe(
  Layer.provide(
    HttpLayerRouter.cors({
      allowedOrigins: [WWW_DOMAIN, STUDIO_DOMAIN, DOCS_DOMAIN],
      credentials: true
    })
  )
);

export const AppLive = HttpLayerRouter.serve(AllRoutes);
