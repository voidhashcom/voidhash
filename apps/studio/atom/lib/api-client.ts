import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import { AtomHttpApi } from '@effect-atom/atom-react';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { API_DOMAIN } from '@voidhash/lib/constants';
import { Layer } from 'effect';

export class ApiClient extends AtomHttpApi.Tag<ApiClient>()('ApiClient', {
  api: VoidhashV1Api,
  // Provide a Layer that provides the HttpClient
  httpClient: FetchHttpClient.layer.pipe(
    Layer.provide(
      Layer.succeed(FetchHttpClient.RequestInit, {
        credentials: 'include'
      })
    )
  ),
  baseUrl: API_DOMAIN
}) {}
