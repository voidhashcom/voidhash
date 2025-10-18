import { Layer } from 'effect';
import { ApiClient } from './api-client';
import { makeAtomRuntime } from './make-api-runtime';
import { VRpc } from './rpc-client';

export const runtime = makeAtomRuntime(
  Layer.mergeAll(ApiClient.layer, VRpc.layer)
);
