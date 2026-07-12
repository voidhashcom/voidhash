import { Layer } from "effect";
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
 * via Vite), Node, and Bun, so we deliberately avoid importing
 * `node:buffer` directly. We detect `Buffer` as an optional global and
 * fall back to `btoa` (which is available in browsers and modern Node).
 */
const encodeBasicAuth = (username: string, password: string): string => {
  const value = `${username}:${password}`;
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } };
    }
  ).Buffer;
  if (maybeBuffer) {
    return `Basic ${maybeBuffer.from(value, "utf8").toString("base64")}`;
  }
  if (typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return `Basic ${globalThis.btoa(binary)}`;
  }
  throw new Error("No base64 encoder is available in this runtime");
};

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

/**
 * Build the Effect Layer that satisfies `RpcClient.Protocol`. This is what
 * gets fed into the runtime that backs every `MimicSDK` instance.
 *
 * Composition (top-down):
 * 1. `RpcClient.layerProtocolHttp` wraps an `HttpClient` so each RPC call
 *    becomes a single HTTP request to `{url}/rpc/v1`. The `transformClient`
 *    hook attaches a Basic Auth header on every request — same pattern the
 *    existing cluster client uses (see `apps/mimic-db/src/cluster/GatewayFanoutClient.ts`).
 * 2. `RpcSerialization.layerNdjson` is the wire format. Server is configured
 *    to match.
 * 3. `FetchHttpClient.layer` provides the underlying `HttpClient` over fetch.
 *    If a custom `fetch` is provided in the config (useful for tests or
 *    server-side runtimes), we set the `FetchHttpClient.Fetch` reference.
 */
export const makeMimicProtocolLayer = (config: MimicClientConfig) => {
  const baseUrl = `${trimTrailingSlashes(config.url)}/rpc/v1`;
  const authorization = encodeBasicAuth(config.username, config.password);

  const httpClientLayer = config.fetch
    ? FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(config.fetch)))
    : FetchHttpClient.layer;

  return RpcClient.layerProtocolHttp({
    url: baseUrl,
    transformClient: (client) =>
      HttpClient.mapRequest(client, HttpClientRequest.setHeader("Authorization", authorization)),
  }).pipe(Layer.provide(RpcSerialization.layerNdjson), Layer.provide(httpClientLayer));
};
