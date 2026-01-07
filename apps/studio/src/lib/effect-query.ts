import { DevTools } from '@effect/experimental';
import { FetchHttpClient } from '@effect/platform';
import { RpcClient, RpcSerialization } from '@effect/rpc';
import { QueryClient } from '@tanstack/react-query';
import { RpcGroups } from '@voidhash/rpc';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  createEffectQuery,
  createEffectQueryFromManagedRuntime
} from 'effect-query';
import { authClient } from './auth-client';
import { env } from './env';

const DevToolsLive = DevTools.layer();

const getAccessTokenEffect = Effect.promise(() =>
  authClient.getAccessToken({
    providerId: 'voidhash-auth'
  })
).pipe(
  Effect.map((token) => token.data?.idToken ?? ''),
  Effect.catchAll(() => Effect.succeed(''))
);

const RequestInitLayer = Layer.effect(
  FetchHttpClient.RequestInit,
  getAccessTokenEffect.pipe(
    Effect.map((token) => ({
      credentials: 'include' as const,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }))
  )
) as Layer.Layer<FetchHttpClient.RequestInit, never, never>;

export const RpcProtocolLive = RpcClient.layerProtocolHttp({
  url: `${env.VITE_APP_API_BASE_URL}/rpc`
}).pipe(
  Layer.provide([
    // use fetch for http requests
    FetchHttpClient.layer.pipe(Layer.provide(RequestInitLayer)),
    // use ndjson for serialization
    RpcSerialization.layerNdjson
  ])
);

export class VoidhashRpc extends Effect.Service<VoidhashRpc>()(
  'voidhash/VoidhashRpc',
  {
    dependencies: [],
    scoped: RpcClient.make(RpcGroups)
  }
) {}

export const LiveLayer = VoidhashRpc.Default.pipe(
  Layer.provideMerge(Layer.mergeAll(RpcProtocolLive, DevToolsLive))
);

export const queryClient = new QueryClient();
export const managedRuntime = ManagedRuntime.make(LiveLayer);
export const eq = createEffectQueryFromManagedRuntime(managedRuntime);

export type EffectQueryType = ReturnType<
  typeof createEffectQueryFromManagedRuntime<typeof LiveLayer>
>;
