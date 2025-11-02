import { HttpApiClient } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { Effect } from 'effect';
import { SdkConfiguration } from '../sdk-configuration';

export class ApiClient extends Effect.Service<ApiClient>()(
  'rn-voidhash/ApiClient',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const sdkConfiguration = yield* SdkConfiguration;
      return yield* HttpApiClient.make(VoidhashV1Api, {
        baseUrl: sdkConfiguration.baseUrl
      });
    })
  }
) {}
