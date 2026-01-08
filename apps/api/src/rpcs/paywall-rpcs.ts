import { PaywallService } from "@voidhash/core/services";
import {
  mysqlSnapshotStoreLayer,
  s3PublishStoreLayerFromEnv,
  S3ClientLayer,
} from "@voidhash/core/services/paywall-design";
import { PaywallRpcsDef } from "@voidhash/rpc";
import { PaywallPublishError } from "@voidhash/shared";
import { Effect, Layer } from "effect";

// Storage layers for paywall publishing
const PublishStorageLayers = Layer.mergeAll(
  mysqlSnapshotStoreLayer,
  s3PublishStoreLayerFromEnv(),
).pipe(Layer.provide(S3ClientLayer));

export const PaywallRpcsLive = PaywallRpcsDef.toLayer(
  Effect.gen(function* PaywallRpcsLive() {
    const paywallService = yield* PaywallService;
    return {
      CreatePaywall: (input) => paywallService.createPaywall(input),
      DeletePaywall: (input) => paywallService.deletePaywall(input),
      GetPublishedPaywallVersions: ({ paywallId }) =>
        paywallService.getPublishedVersions(paywallId).pipe(
          Effect.catchTag("S3PublishError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.cause) }))
          ),
          Effect.catchTag("DatabaseError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.message) }))
          )
        ),
      ListPaywalls: ({ projectId }) =>
        Effect.gen(function* ListPaywalls() {
          return yield* paywallService.getPaywalls(projectId);
        }),
      PublishPaywall: ({ paywallId }) =>
        paywallService.publishPaywall(paywallId).pipe(
          Effect.catchTag("S3PublishError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.cause) }))
          ),
          Effect.catchTag("MySqlSnapshotError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.cause) }))
          ),
          Effect.catchTag("DatabaseError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.message) }))
          )
        ),
      RequestPaywallEditToken: ({ paywallId }) =>
        paywallService.createEditToken(paywallId),
      SetActivePaywallVersion: ({ paywallId, version }) =>
        paywallService.setActiveVersion(paywallId, version).pipe(
          Effect.catchTag("S3PublishError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.cause) }))
          ),
          Effect.catchTag("DatabaseError", (e) =>
            Effect.fail(new PaywallPublishError({ message: String(e.message) }))
          )
        ),
    };
  })
).pipe(
  Layer.provide(PaywallService.Default),
  Layer.provide(PublishStorageLayers),
);
