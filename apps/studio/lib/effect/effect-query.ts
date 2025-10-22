import { FetchHttpClient } from '@effect/platform';
import { RpcClient, RpcSerialization } from '@effect/rpc';
import { API_DOMAIN } from '@voidhash/lib/constants';
import { RpcGroups } from '@voidhash/rpc';
import { Layer, Logger } from 'effect';
import { createEffectQuery } from './tanstack-query';

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

export const VoidhashRpc = RpcClient.make(RpcGroups);

export const LiveLayer = Layer.mergeAll(RpcProtocolLive, Layer.scope).pipe(
  Layer.provide(Logger.pretty)
);

export const effectQuery = createEffectQuery(LiveLayer);
