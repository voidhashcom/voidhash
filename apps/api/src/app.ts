import { HttpApiBuilder, HttpApiScalar, HttpServer } from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';
import { BetterAuth } from '@voidhash/auth/effect';
import { AuthService, EnvironmentService } from '@voidhash/core/services';
import { Db } from '@voidhash/db/effect';
import { Layer } from 'effect';
import { AuthGroupLive } from './routes/v1/auth';
import { CustomersGroupLive } from './routes/v1/customers';
import { SdkGroupLive } from './routes/v1/sdk';

const VoidhashApiLive = HttpApiBuilder.api(VoidhashApi).pipe(
  Layer.provide(Layer.mergeAll(AuthGroupLive)),
  Layer.provide(Layer.mergeAll(CustomersGroupLive)),
  Layer.provide(Layer.mergeAll(SdkGroupLive)),
  Layer.provide(
    Layer.mergeAll(
      AuthService.Default,
      EnvironmentService.Default,
      BetterAuth.Default,
      Db.Default
    )
  )
);

const DocsRoute = HttpApiScalar.layer({
  path: '/api/docs'
}).pipe(Layer.provide(VoidhashApiLive));

export const Routes = Layer.mergeAll(
  VoidhashApiLive,
  DocsRoute,
  HttpServer.layerContext
);
