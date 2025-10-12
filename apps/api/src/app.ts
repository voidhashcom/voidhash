import { HttpApiBuilder, HttpApiScalar, HttpServer } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { BetterAuth } from '@voidhash/auth/effect';
import {
  ApiKeyService,
  AppStoreServerAPIService,
  AppStoreService,
  CustomerService,
  OrganizationService,
  PaymentProviderProductService,
  PaymentProviderService,
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
import { Layer } from 'effect';
import { AuthMiddlewareLive } from './middlewares';
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

const VoidhashV1ApiRoutes = HttpApiBuilder.api(VoidhashV1Api).pipe(
  Layer.provide(V1GroupsLayer),

  Layer.provide(
    Layer.mergeAll(
      AuthMiddlewareLive,
      ApiKeyService.Default,
      AppStoreServerAPIService.Default,
      AppStoreService.Default,
      CustomerService.Default,
      OrganizationService.Default,
      PaymentProviderProductService.Default,
      PaymentProviderService.Default,
      PerkGrantService.Default,
      PerkService.Default,
      ProductPerkService.Default,
      ProductService.Default,
      ProjectService.Default,
      SdkService.Default,
      UserService.Default
    )
  ),
  Layer.provide(Layer.mergeAll(BetterAuth.Default, Db.Default))
);

const DocsRoute = HttpApiScalar.layer({
  path: '/api/docs'
}).pipe(Layer.provide(VoidhashV1ApiRoutes));

const ApiRoutesLayer = Layer.mergeAll(VoidhashV1ApiRoutes, DocsRoute);

export const Routes = Layer.mergeAll(
  ApiRoutesLayer,
  HttpApiBuilder.middlewareCors({
    allowedOrigins: [WWW_DOMAIN, STUDIO_DOMAIN, DOCS_DOMAIN],
    credentials: true
  }),
  HttpServer.layerContext
);
