import { HttpApiClient } from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';

export const ApiClient = HttpApiClient.make(VoidhashApi, {
  baseUrl: 'http://localhost:5001'
});
