import * as Encoding from "effect/Encoding";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

export interface MimicClientConfig {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Cross-runtime Basic auth encoder. The SDK runs in browsers (admin app
 * via Vite), Node, and Bun, so we rely on Effect's `Encoding` module, which
 * base64-encodes the UTF-8 bytes of the credential pair without touching a
 * runtime-specific global such as `Buffer` or `btoa`.
 */
const encodeBasicAuth = (username: string, password: string): string =>
  `Basic ${Encoding.encodeBase64(`${username}:${password}`)}`;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

/**
 * Underlying `HttpClient` layer: `FetchHttpClient.layer`, with the
 * `FetchHttpClient.Fetch` reference overridden when the caller supplied a
 * custom `fetch` implementation.
 */
const makeHttpClientLayer = (customFetch: Option.Option<typeof globalThis.fetch>) =>
  Option.match(customFetch, {
    onNone: () => FetchHttpClient.layer,
    onSome: (fetch) =>
      FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
  });

/**
 * Build the Effect Layer that satisfies `RpcClient.Protocol`. This is what
 * gets fed into the runtime that backs every `MimicSDK` instance.
 *
 * Composition (top-down):
 * 1. `RpcClient.layerProtocolHttp` wraps an `HttpClient` so each RPC call
 *    becomes a single HTTP request to `{url}/rpc/v1`. The `transformClient`
 *    hook attaches a Basic Auth header on every request — same pattern the
 *    existing cluster client uses (see `vendored/mimic/apps/mimic-db/src/cluster/GatewayFanoutClient.ts`).
 * 2. `RpcSerialization.layerNdjson` is the wire format. Server is configured
 *    to match.
 * 3. `FetchHttpClient.layer` provides the underlying `HttpClient` over fetch.
 *    If a custom `fetch` is provided in the config (useful for tests or
 *    server-side runtimes), we set the `FetchHttpClient.Fetch` reference.
 */
export const makeMimicProtocolLayer = (config: MimicClientConfig) => {
  const baseUrl = `${trimTrailingSlashes(config.url)}/rpc/v1`;
  const authorization = encodeBasicAuth(config.username, config.password);

  const httpClientLayer = makeHttpClientLayer(Option.fromUndefinedOr(config.fetch));

  return RpcClient.layerProtocolHttp({
    url: baseUrl,
    transformClient: (client) =>
      HttpClient.mapRequest(client, HttpClientRequest.setHeader("Authorization", authorization)),
  }).pipe(Layer.provide(RpcSerialization.layerNdjson), Layer.provide(httpClientLayer));
};
