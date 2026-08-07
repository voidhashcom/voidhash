import {
  ApiAuthSession,
  AuthMiddleware,
  VoidhashV1Api,
  type ApiPublishableKeySession,
} from "@voidhash/api-contracts";
import {
  FeatureFlagService,
  InternalFeatureFlagService,
  NotificationTokenService,
  PaywallLocationService,
  PersonIdentityService,
  SchemaService,
  SdkService,
} from "@voidhash/core/services";
import { Db } from "@voidhash/db";
import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { SdkGroupLive } from "../routes/v1/sdk.ts";

const unusedApiGroups: Layer.Layer<any> = Layer.effectContext(
  Effect.sync(() =>
    Context.makeUnsafe(
      new Map(
        Object.values(VoidhashV1Api.groups)
          .filter((group) => group.identifier !== "sdk")
          .map((group) => [group.key, { handlers: new Map(), routes: [] }]),
      ),
    ),
  ),
);

// The SDK group never reaches for these services, so the harness supplies empty
// placeholders the same way `unusedApiGroups` does above.
const unusedSdkRouteServices = Layer.effectContext(
  Effect.sync(() =>
    Context.makeUnsafe<
      | FeatureFlagService
      | InternalFeatureFlagService
      | NotificationTokenService
      | PaywallLocationService
      | SchemaService
    >(
      new Map([
        [FeatureFlagService.key, {}],
        [InternalFeatureFlagService.key, {}],
        [NotificationTokenService.key, {}],
        [PaywallLocationService.key, {}],
        [SchemaService.key, {}],
      ]),
    ),
  ),
);

/** Builds an in-process Web handler for the real SDK `HttpApi` group. */
export const makePurchaseSdkHttpHandler = (
  sdkLayer: Layer.Layer<SdkService | PersonIdentityService | Db, never, never>,
  session: ApiPublishableKeySession,
) => {
  const authentication = Layer.succeed(
    AuthMiddleware,
    AuthMiddleware.of((effect) => Effect.provideService(effect, ApiAuthSession, session)),
  );
  const routes = HttpApiBuilder.layer(VoidhashV1Api).pipe(
    Layer.provide(Layer.mergeAll(SdkGroupLive, unusedApiGroups)),
    Layer.provide(authentication),
    Layer.provide(unusedSdkRouteServices),
    Layer.provide(sdkLayer),
    Layer.provide(HttpServer.layerServices),
  );

  return HttpRouter.toWebHandler(routes, { disableLogger: true });
};
