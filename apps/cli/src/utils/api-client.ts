import { HttpApiClient } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';

export const ApiClient = HttpApiClient.make(VoidhashV1Api, {
  baseUrl: 'http://localhost:5001'
});
