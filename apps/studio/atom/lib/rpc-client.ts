import { FetchHttpClient } from '@effect/platform';
import { RpcClient, RpcSerialization } from '@effect/rpc';
import { AtomRpc } from '@effect-atom/atom-react';
import { API_DOMAIN } from '@voidhash/lib/index';
import { RpcGroups } from '@voidhash/rpc';
import { Layer } from 'effect';

const RpcProtocolLive = RpcClient.layerProtocolHttp({
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

export class VRpc extends AtomRpc.Tag<VRpc>()('VRpc', {
  group: RpcGroups,
  // Provide a Layer that provides the RpcClient.Protocol
  protocol: RpcProtocolLive
}) {}
