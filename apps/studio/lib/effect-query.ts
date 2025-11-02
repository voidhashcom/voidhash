import { DevTools } from '@effect/experimental';
import { FetchHttpClient } from '@effect/platform';
import { RpcClient, RpcSerialization } from '@effect/rpc';
import { QueryClient } from '@tanstack/react-query';
import { API_DOMAIN } from '@voidhash/lib/constants';
import { RpcGroups } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';
import { createEffectQuery } from 'effect-query';

const DevToolsLive = DevTools.layer();

export const RpcProtocolLive = RpcClient.layerProtocolHttp({
  url: `${API_DOMAIN}/rpc`
}).pipe(
  Layer.provide([
    // use fetch for http requests
    FetchHttpClient.layer.pipe(
      Layer.provide(
        Layer.succeed(FetchHttpClient.RequestInit, {
          credentials: 'include'
        })
      )
    ),
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
export const eq = createEffectQuery(LiveLayer);
