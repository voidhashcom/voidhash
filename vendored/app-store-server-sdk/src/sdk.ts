import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { HttpClient } from "effect/unstable/http";

/**
 * Shared App Store Server SDK handle. Holds the long-lived `HttpClient`
 * instance so per-tenant clients and verifiers can close over a single HTTP
 * connection pool instead of each building their own.
 *
 * Multi-tenant deployments provide `AppStoreServerSdk.layer` once at app boot
 * (composed with `FetchHttpClient.layer` or a mock) and then create as many
 * `AppStoreServerSdkClient` / `SignedDataVerifier` instances as needed via the
 * synchronous `.make(sdk, config)` factories.
 */
export class AppStoreServerSdk extends Context.Service<
  AppStoreServerSdk,
  {
    /** Shared HTTP client used by all `AppStoreServerSdkClient.make` instances. */
    readonly httpClient: HttpClient.HttpClient;
  }
>()("AppStoreServerSdk") {
  static layer = Layer.effect(AppStoreServerSdk)(
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      return AppStoreServerSdk.of({ httpClient });
    }),
  );
}
