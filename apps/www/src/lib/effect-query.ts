import { QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Data, Effect, Layer, ManagedRuntime, Context } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcClientError, RpcSerialization } from "effect/unstable/rpc";
import { createEffectQueryFromManagedRuntime } from "effect-query";
import { RpcGroups } from "@voidhash/rpc";

import { env } from "./env";

const StudioRpcGroups = RpcGroups;

class RpcQueryError extends Data.TaggedError("RpcQueryError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

type TaggedError = {
  readonly _tag: string;
};

const isTaggedError = (cause: unknown): cause is TaggedError =>
  typeof cause === "object" &&
  cause !== null &&
  "_tag" in cause &&
  typeof Reflect.get(cause, "_tag") === "string";

const getServerCookieHeader = createIsomorphicFn()
  .server(() => getRequestHeaders().get("cookie") ?? undefined)
  .client(() => undefined);

type AccessTokenProvider = () => Promise<string | undefined>;

let browserAccessTokenProvider: AccessTokenProvider | undefined;

export const setBrowserAccessTokenProvider = (provider: AccessTokenProvider | undefined) => {
  browserAccessTokenProvider = provider;
};

const getClientAccessToken = async (): Promise<string | undefined> => {
  if (import.meta.env.SSR) {
    return undefined;
  }

  try {
    return (await browserAccessTokenProvider?.()) ?? undefined;
  } catch {
    return undefined;
  }
};

const RequestInitLayer = Layer.succeed(
  FetchHttpClient.RequestInit,
  FetchHttpClient.RequestInit.of({
    credentials: "include" as const,
  }),
);

/**
 * Each outbound RPC call gets a fresh `x-request-id` correlation id; the backend
 * stamps it as `voidhash.request.id` and echoes it back, so a user action can be
 * quoted in a bug report and found in Axiom.
 *
 * We deliberately do NOT send a W3C `traceparent` (nor client RPC span context —
 * see `disableTracing` on the client below): the browser runs Effect's no-op
 * tracer and exports no spans, so propagating trace context would only parent the
 * backend's real, exported spans to a client span that never arrives — surfacing
 * as a "(missing)" parent in Axiom and splitting one request across two traces.
 * The backend's `http.server` span is the trace root; `x-request-id` is the
 * cross-process correlation id. (Re-introduce propagation only once the browser
 * actually exports its spans.)
 */
const withAuthCookie = <E, R>(client: HttpClient.HttpClient.With<E, R>) =>
  HttpClient.mapRequestEffect(client, (request) =>
    Effect.promise(async () => {
      const [cookie, accessToken] = await Promise.all([
        getServerCookieHeader(),
        getClientAccessToken(),
      ]);

      let authenticatedRequest = HttpClientRequest.setHeader(
        request,
        "x-request-id",
        `req_${crypto.randomUUID()}`,
      );

      if (cookie) {
        authenticatedRequest = HttpClientRequest.setHeader(
          authenticatedRequest,
          "Cookie",
          cookie,
        );
      }

      if (accessToken) {
        authenticatedRequest = HttpClientRequest.setHeader(
          authenticatedRequest,
          "Authorization",
          `Bearer ${accessToken}`,
        );
      }

      return authenticatedRequest;
    }),
  );

const getRuntimeApiBaseURL = (): string => env.VITE_APP_API_URL.replace(/\/+$/, "");

export const RpcProtocolLive = RpcClient.layerProtocolHttp({
  url: `${getRuntimeApiBaseURL()}/rpc`,
  transformClient: withAuthCookie,
}).pipe(
  Layer.provide([
    FetchHttpClient.layer.pipe(Layer.provide(RequestInitLayer)),
    RpcSerialization.layerNdjson,
  ]),
);

type VoidhashRpcClient = RpcClient.FromGroup<typeof StudioRpcGroups, RpcClientError.RpcClientError>;

export class VoidhashRpc extends Context.Service<VoidhashRpc, VoidhashRpcClient>()(
  "voidhash/VoidhashRpc",
  {
    // `disableTracing` stops the client from minting a per-call RPC span and
    // propagating its id in the request envelope. The browser's no-op tracer
    // never exports those spans, so without this the backend's `RpcServer.<tag>`
    // span parents to a client span that never arrives ("(missing)" parent) and
    // lands in the client's trace id instead of nesting under `http.server`.
    // Disabling it lets `RpcServer` fall back to the ambient `http.server` parent.
    make: RpcClient.make(StudioRpcGroups, {
      disableTracing: true,
    }) as Effect.Effect<VoidhashRpcClient>,
  },
) {
  static request<XA, XR>(
    f: (rpc: VoidhashRpcClient) => Effect.Effect<XA, unknown, XR>,
  ): Effect.Effect<XA, TaggedError | RpcQueryError, XR | VoidhashRpc> {
    return super.use(f).pipe(
      Effect.mapError((cause) =>
        isTaggedError(cause)
          ? cause
          : new RpcQueryError({
              cause,
              message: "RPC request failed",
            }),
      ),
    );
  }
}

export const LiveLayer = Layer.effect(VoidhashRpc)(VoidhashRpc.make).pipe(
  Layer.provideMerge(RpcProtocolLive),
);

export const queryClient = new QueryClient();
export const managedRuntime = ManagedRuntime.make(LiveLayer);
export const eq = createEffectQueryFromManagedRuntime(managedRuntime);

export type EffectQueryType = ReturnType<
  typeof createEffectQueryFromManagedRuntime<typeof LiveLayer>
>;
